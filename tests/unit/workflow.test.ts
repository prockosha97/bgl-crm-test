import { describe, expect, it } from 'vitest';
import { transition, statusAfterEdit } from '../../shared/workflow.js';
import { effectiveText, postInputSchema, campaignSchema } from '../../shared/contracts.js';
import { localToUtc, zonedDay, zonedInput, shiftDay } from '../../shared/time.js';
const scheduling = { scheduledAt: new Date('2030-01-01T10:00:00Z'), platforms: 2, now: new Date('2029-01-01T00:00:00Z') };
describe('post workflow', () => {
  it('supports idea → draft → review → approved → scheduled with distinct permissions', () => {
    expect(transition('idea','draft','CONTENT_MANAGER',scheduling)).toBe('draft');
    expect(transition('draft','submit','CONTENT_MANAGER',scheduling)).toBe('review');
    expect(transition('review','approve','APPROVER',scheduling)).toBe('approved');
    expect(transition('approved','schedule','CONTENT_MANAGER',scheduling)).toBe('scheduled');
  });
  it('rejects approval by content managers and all mutations by viewers', () => {
    expect(() => transition('review','approve','CONTENT_MANAGER',scheduling)).toThrow();
    for (const action of ['draft','submit','approve','reject','schedule','cancel'] as const) expect(() => transition('review',action,'VIEWER',scheduling)).toThrow();
    expect(() => transition('approved','schedule','APPROVER',scheduling)).toThrow();
  });
  it('requires approved status, a future date and a platform for scheduling', () => {
    expect(() => transition('draft','schedule','ADMIN',scheduling)).toThrow();
    expect(() => transition('approved','schedule','ADMIN',{...scheduling,scheduledAt:null})).toThrow();
    expect(() => transition('approved','schedule','ADMIN',{...scheduling,platforms:0})).toThrow();
    expect(() => transition('approved','schedule','ADMIN',{...scheduling,scheduledAt:scheduling.now})).toThrow();
    expect(() => transition('draft','submit','ADMIN',{...scheduling,platforms:0})).toThrow();
  });
  it('returns rejected posts to draft and resets approved/scheduled on edit', () => {
    expect(transition('review','reject','APPROVER',scheduling)).toBe('changes_requested');
    expect(transition('changes_requested','draft','CONTENT_MANAGER',scheduling)).toBe('draft');
    expect(statusAfterEdit('approved')).toBe('draft'); expect(statusAfterEdit('scheduled')).toBe('draft');
    for (const status of ['review','publishing','published','failed','partially_published','cancelled'] as const) expect(() => statusAfterEdit(status)).toThrow();
  });
  it('does not allow HTTP workflow to cancel an active or finished publication', () => {
    expect(transition('scheduled','cancel','ADMIN',scheduling)).toBe('cancelled');
    expect(() => transition('publishing','cancel','ADMIN',scheduling)).toThrow();
  });
});
describe('variant inheritance and contracts', () => {
  it('inherits live base text and preserves explicitly empty overrides for validation', () => {
    const variant={inheritBaseText:true,text:'old override'};
    expect(effectiveText('new base',variant)).toBe('new base');
    expect(effectiveText('new base',{...variant,inheritBaseText:false})).toBe('old override');
    expect(effectiveText('base',{inheritBaseText:false,text:''})).toBe('');
  });
  const input={internalTitle:'Title',baseText:'Text',ctaUrl:null,scheduledAt:null,timezone:'Europe/Moscow',rubricId:null,campaignId:null,tagIds:[],platforms:['telegram'],variants:[]};
  it('rejects duplicate platforms and inconsistent variants', () => {
    expect(postInputSchema.safeParse({...input,platforms:['telegram','telegram']}).success).toBe(false);
    expect(postInputSchema.safeParse({...input,variants:[{platform:'vk',inheritBaseText:true,text:''}]}).success).toBe(false);
    expect(postInputSchema.safeParse({...input,ctaUrl:'javascript:alert(1)'}).success).toBe(false);
    expect(postInputSchema.safeParse({...input,timezone:'Made/Up'}).success).toBe(false);
  });
  it('normalizes blank optional URLs and rejects backwards campaigns', () => {
    expect(postInputSchema.parse({...input,ctaUrl:''}).ctaUrl).toBeNull();
    expect(campaignSchema.safeParse({name:'C',slug:'c',utmCampaign:'c',dateFrom:'2030-02-01T00:00:00Z',dateTo:'2030-01-01T00:00:00Z'}).success).toBe(false);
  });
});
describe('calendar UTC and timezones', () => {
  it('converts Moscow calendar values without assuming host timezone', () => {
    expect(localToUtc('2030-01-01T12:30','Europe/Moscow')).toBe('2030-01-01T09:30:00.000Z');
    expect(zonedInput('2030-01-01T09:30:00Z','Europe/Moscow')).toBe('2030-01-01T12:30');
    expect(zonedDay('2030-01-01T23:30:00Z','Europe/Moscow')).toBe('2030-01-02');
  });
  it('handles DST and rejects missing wall-clock hours', () => {
    expect(localToUtc('2026-07-01T12:00','Europe/Berlin')).toBe('2026-07-01T10:00:00.000Z');
    expect(localToUtc('2026-01-01T12:00','Europe/Berlin')).toBe('2026-01-01T11:00:00.000Z');
    expect(() => localToUtc('2026-03-29T02:30','Europe/Berlin')).toThrow();
  });
  it('handles month and year boundaries', () => { expect(shiftDay('2026-12-31',1)).toBe('2027-01-01'); });
});
