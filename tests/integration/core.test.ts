import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDatabase } from '../../server/src/infrastructure/database.js';
import { buildApp } from '../../server/src/app.js';
import { hashPassword } from '../../server/src/modules/auth/security.js';
import type { Config } from '../../server/src/shared/config.js';
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must target isolated *_test database');
const db = createDatabase(url); let app: FastifyInstance;
const config: Config = { DATABASE_URL:url,NODE_ENV:'test',PORT:80,APP_BASE_URL:'http://localhost:80',SESSION_SECRET:'test-only-session-secret-with-at-least-32-characters',MEDIA_ROOT:'/tmp/bgl-media-test',OK_ENABLED:'false' };
type Headers = Record<string,string>;
const users: Record<string,{id:string;headers:Headers}> = {};
let rubricId: string; let campaignId: string; let tagId: string;
const input = () => ({ internalTitle:'Новая лекция',baseText:'Базовый текст',ctaUrl:'https://bgl.example/lecture?a=b#watch',timezone:'Europe/Moscow',scheduledAt:'2035-01-01T09:00:00Z',rubricId,campaignId,tagIds:[tagId],platforms:['telegram','max','vk'],variants:[{platform:'telegram',inheritBaseText:false,text:'Версия Telegram'}] });
beforeAll(async () => {
  await db.session.deleteMany(); await db.auditLog.deleteMany(); await db.approval.deleteMany(); await db.postTag.deleteMany(); await db.postVariant.deleteMany(); await db.postPlatform.deleteMany(); await db.post.deleteMany(); await db.user.deleteMany(); await db.tag.deleteMany(); await db.rubric.deleteMany(); await db.campaign.deleteMany();
  const passwordHash=await hashPassword('integration-password');
  app=await buildApp({db,config},{logger:false});
  for(const role of ['ADMIN','CONTENT_MANAGER','APPROVER','VIEWER'] as const) {
    const user=await db.user.create({data:{email:`${role.toLowerCase()}@test.local`,name:role,role,passwordHash}});
    const response=await app.inject({method:'POST',url:'/api/auth/login',headers:{origin:'http://localhost'},payload:{email:user.email,password:'integration-password'}});
    expect(response.statusCode).toBe(200);
    users[role]={id:user.id,headers:{cookie:String(response.headers['set-cookie']).split(';')[0],origin:'http://localhost','x-csrf-token':response.json().csrfToken}};
  }
  rubricId=(await db.rubric.create({data:{name:'Рубрика'}})).id;
  campaignId=(await db.campaign.create({data:{name:'Кампания',slug:'campaign',utmCampaign:'campaign'}})).id;
  tagId=(await db.tag.create({data:{name:'Тег'}})).id;
});
afterAll(async()=>{await app?.close();await db.$disconnect();});
async function request(role: string, method: 'GET'|'POST'|'PUT'|'DELETE', url: string, payload?: object) { return app.inject({method,url,headers:users[role].headers,payload}); }
async function create(extra: object={}) {const result=await request('CONTENT_MANAGER','POST','/api/posts',{...input(),...extra});expect(result.statusCode).toBe(201);return result.json();}
async function action(post: {id:string;version:number}, action:string, role='CONTENT_MANAGER') {return request(role,'POST',`/api/posts/${post.id}/actions`,{action,version:post.version});}
describe('core content API with PostgreSQL',()=>{
  it('creates three variants and saves rubric, campaign, tags and BGL reference',async()=>{
    const post=await create({contentEntityType:'lecture',contentEntityId:'184',contentEntityUrl:'https://bgl.example/184'});
    expect(post.variants).toHaveLength(3);expect(post.variants.find((v:{platform:string})=>v.platform==='max').inheritBaseText).toBe(true);
    expect(post.variants.find((v:{platform:string})=>v.platform==='telegram').text).toBe('Версия Telegram');
    expect(post.tags[0].tag.name).toBe('Тег');expect(post.rubric.name).toBe('Рубрика');expect(post.campaign.slug).toBe('campaign');expect(post.contentEntityId).toBe('184');
    expect(post.author).not.toHaveProperty('passwordHash');expect(post.scheduledAt).toBe('2035-01-01T09:00:00.000Z');
  });
  it('completes draft → review → approve → schedule, storing decision and audit',async()=>{
    let post=await create();let response=await action(post,'submit');expect(response.statusCode).toBe(200);post=response.json();
    expect((await action(post,'approve')).statusCode).not.toBe(200);
    response=await action(post,'approve','APPROVER');expect(response.statusCode).toBe(200);post=response.json();
    expect((await action(post,'schedule','APPROVER')).statusCode).not.toBe(200);
    response=await action(post,'schedule');expect(response.statusCode).toBe(200);post=response.json();expect(post.status).toBe('scheduled');
    expect(await db.approval.count({where:{postId:post.id,approverId:users.APPROVER.id}})).toBe(1);
    expect(await db.auditLog.count({where:{entityId:post.id}})).toBe(4);
    expect(await db.publicationJob.count()).toBe(0); // Worker is outside Phase 1.
  });
  it('returns rejected posts for correction',async()=>{
    const post=await create();const submitted=(await action(post,'submit')).json();const rejected=(await action(submitted,'reject','APPROVER')).json();
    expect(rejected.status).toBe('changes_requested');expect((await action(rejected,'draft')).json().status).toBe('draft');
  });
  it('resets agreement and increments publicationVersion after a scheduled date change',async()=>{
    let post=await create();post=(await action(post,'submit')).json();post=(await action(post,'approve','ADMIN')).json();post=(await action(post,'schedule')).json();
    const response=await request('CONTENT_MANAGER','PUT',`/api/posts/${post.id}`,{...input(),version:post.version,scheduledAt:'2035-01-02T09:00:00Z'});
    expect(response.statusCode).toBe(200);expect(response.json().status).toBe('draft');expect(response.json().publicationVersion).toBe(2);
    expect(await db.auditLog.count({where:{entityId:post.id,action:'post_date_changed'}})).toBe(1);
  });
  it('allows only one concurrent save with the same version and rolls back the loser',async()=>{
    const post=await create();const results=await Promise.all(['first','second'].map(internalTitle=>request('CONTENT_MANAGER','PUT',`/api/posts/${post.id}`,{...input(),internalTitle,version:post.version})));
    expect(results.map(x=>x.statusCode).sort()).toEqual([200,409]);
    expect((await db.post.findUniqueOrThrow({where:{id:post.id}})).version).toBe(2);
    expect(await db.postVariant.count({where:{postId:post.id}})).toBe(3);
  });
  it('rejects empty variant submission, disabled OK and invalid relations',async()=>{
    const post=await create({baseText:''});expect((await action(post,'submit')).statusCode).toBe(400);
    expect((await request('CONTENT_MANAGER','POST','/api/posts',{...input(),platforms:['ok'],variants:[]})).statusCode).toBe(400);
    expect((await request('CONTENT_MANAGER','POST','/api/posts',{...input(),rubricId:'00000000-0000-4000-8000-000000000000'})).statusCode).toBe(409);
  });
  it('guards all write endpoints and sensitive user information by role',async()=>{
    const post=await create();
    for(const role of ['VIEWER','APPROVER']) expect((await request(role,'POST','/api/posts',input())).statusCode).toBe(403);
    expect((await request('VIEWER','PUT',`/api/posts/${post.id}`,{...input(),version:post.version})).statusCode).toBe(403);
    expect((await action(post,'cancel','VIEWER')).statusCode).not.toBe(200);
    expect((await request('VIEWER','GET','/api/users')).statusCode).toBe(403);
    expect((await request('CONTENT_MANAGER','POST','/api/catalog/rubrics',{name:'Forbidden'})).statusCode).toBe(403);
    const list=await request('ADMIN','GET','/api/users');expect(list.statusCode).toBe(200);expect(list.json()[0]).not.toHaveProperty('passwordHash');
  });
  it('lists backlog and calendar with platform/status/author filters',async()=>{
    const idea=await create({status:'idea',scheduledAt:null});
    const list=await request('VIEWER','GET',`/api/posts?backlog=true&status=idea&platform=telegram&authorId=${users.CONTENT_MANAGER.id}`);
    expect(list.json().items.some((p:{id:string})=>p.id===idea.id)).toBe(true);
    const calendar=await request('VIEWER','GET','/api/posts?from=2035-01-01T00:00:00Z&to=2035-01-02T00:00:00Z');
    expect(calendar.json().items.every((p:{scheduledAt:string})=>p.scheduledAt?.startsWith('2035-01-01'))).toBe(true);
    expect((await request('VIEWER','GET','/api/dashboard?timezone=Europe%2FMoscow')).statusCode).toBe(200);
  });
  it('cancels without deleting audit or post records',async()=>{
    const post=await create();const result=await action(post,'cancel');expect(result.json().status).toBe('cancelled');
    expect(result.json().platforms.every((p:{status:string})=>p.status==='cancelled')).toBe(true);
    expect(await db.post.count({where:{id:post.id}})).toBe(1);
    expect((await request('CONTENT_MANAGER','PUT',`/api/posts/${post.id}`,{...input(),version:result.json().version})).statusCode).toBe(409);
  });
  it('supports ADMIN catalog CRUD and prevents deletion of referenced records',async()=>{
    const response=await request('ADMIN','POST','/api/catalog/tags',{name:'Temporary'});expect(response.statusCode).toBe(201);
    const id=response.json().id;expect((await request('ADMIN','PUT',`/api/catalog/tags/${id}`,{name:'Renamed'})).statusCode).toBe(200);
    expect((await request('ADMIN','DELETE',`/api/catalog/tags/${id}`)).statusCode).toBe(200);
    expect((await request('ADMIN','DELETE',`/api/catalog/rubrics/${rubricId}`)).statusCode).toBe(409);
  });
  it('preserves the final ADMIN and revokes a disabled user session',async()=>{
    expect((await request('ADMIN','PUT',`/api/users/${users.ADMIN.id}`,{name:'Admin',role:'VIEWER',isActive:true})).statusCode).toBe(409);
    expect((await request('ADMIN','PUT',`/api/users/${users.VIEWER.id}`,{name:'Viewer',role:'VIEWER',isActive:false})).statusCode).toBe(200);
    expect((await request('VIEWER','GET','/api/posts')).statusCode).toBe(401);
  });
  it('creates accounts and invalidates sessions on password reset',async()=>{
    expect((await request('ADMIN','POST','/api/users',{email:'new@test.local',name:'New user',role:'VIEWER',password:'a-new-strong-password'})).statusCode).toBe(201);
    expect((await request('ADMIN','POST',`/api/users/${users.APPROVER.id}/password`,{password:'a-different-password'})).statusCode).toBe(200);
    expect((await request('APPROVER','GET','/api/posts')).statusCode).toBe(401);
  });
});
