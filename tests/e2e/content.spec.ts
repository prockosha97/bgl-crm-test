import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const password=process.env.DEV_SEED_PASSWORD;
if(!password) throw new Error('Set DEV_SEED_PASSWORD and run npm run test:db:prepare');
async function login(page:Page,email:string) {await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Пароль',{exact:true}).fill(password!);await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.getByRole('heading',{name:'Обзор контента'})).toBeVisible();}
test('login → create → override Telegram → review → approve → schedule',async({page})=>{
  const title=`E2E ${randomUUID()}`;
  await login(page,'content@example.local');
  await page.getByRole('link',{name:'Новая публикация',exact:true}).click();
  await page.getByLabel('Внутреннее название').fill(title);
  await page.getByLabel('Базовый текст',{exact:true}).fill('Общий текст новой лекции');
  await page.getByLabel('Дата и время',{exact:true}).fill('2035-01-01T12:00');
  await page.getByLabel('Telegram',{exact:true}).check();await page.getByLabel('MAX',{exact:true}).check();await page.getByLabel('VK',{exact:true}).check();
  const telegram=page.locator('.variant').filter({has:page.getByRole('heading',{name:'Telegram',exact:true})});
  await telegram.getByLabel('Наследовать базовый текст').uncheck();await telegram.getByLabel('Текст Telegram').fill('Отдельная версия Telegram');
  await expect(page.locator('.preview')).toContainText('Отдельная версия Telegram');
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page).toHaveURL(/\/posts\/[a-f0-9-]+$/);const url=page.url();
  await page.getByRole('button',{name:'На согласование',exact:true}).click();await expect(page.locator('header .badge')).toContainText('На согласовании');
  await page.getByRole('button',{name:'Выйти',exact:true}).click();await login(page,'approver@example.local');await page.goto(url);
  await page.getByRole('button',{name:'Согласовать',exact:true}).click();await expect(page.locator('header .badge')).toContainText('Согласовано');
  await page.getByRole('button',{name:'Выйти',exact:true}).click();await login(page,'content@example.local');await page.goto(url);
  await page.getByRole('button',{name:'Запланировать',exact:true}).click();await expect(page.locator('header .badge')).toContainText('Запланировано');
  await page.reload();await expect(page.locator('header .badge')).toContainText('Запланировано');await expect(page.getByLabel('Текст Telegram')).toHaveValue('Отдельная версия Telegram');
  await page.getByRole('link',{name:'Календарь',exact:true}).click();await page.getByLabel('Период',{exact:true}).fill('2035-01-01');await expect(page.getByRole('link',{name:title,exact:true})).toBeVisible();
});
test('backlog idea and confirmed calendar rescheduling',async({page})=>{
  const title=`Idea ${randomUUID()}`;await login(page,'content@example.local');await page.goto('/posts/new');await page.getByLabel('Внутреннее название').fill(title);await page.getByLabel('Создать как').selectOption('idea');await page.getByRole('button',{name:'Сохранить',exact:true}).click();await expect(page).toHaveURL(/\/posts\/[a-f0-9-]+$/);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Бэклог',exact:true}).click();await expect(page.getByRole('link',{name:title})).toBeVisible();await page.getByRole('link',{name:'Календарь',exact:true}).click();await page.getByLabel('Период',{exact:true}).fill('2035-01-01');
  await page.locator('.post-card').filter({has:page.getByRole('link',{name:title})}).dragTo(page.getByRole('region',{name:'2035-01-02',exact:true}),{sourcePosition:{x:5,y:5},targetPosition:{x:20,y:20}});
  const dialog=page.getByRole('dialog',{name:'Перенести публикацию'});await expect(dialog).toBeVisible();await expect(dialog).toContainText('Без даты');await dialog.getByRole('button',{name:'Перенести',exact:true}).click();await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('region',{name:'2035-01-02',exact:true}).getByRole('link',{name:title})).toBeVisible();
});
test('mobile navigation and first content screen remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page,'admin@example.local');await page.getByRole('link',{name:'Пользователи',exact:true}).click();await expect(page.getByRole('heading',{name:'Пользователи',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Добавить пользователя'})).toBeVisible();
});
