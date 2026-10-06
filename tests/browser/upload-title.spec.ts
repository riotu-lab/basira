import {test,expect} from '@playwright/test';
test('text uploads preserve the title chosen by the reviewer',async({page})=>{
 await page.goto('/?app=content&lang=en');await page.locator('#report-title').fill('Chosen publication title');
 await page.locator('input[type=file]').setInputFiles({name:'sample.txt',mimeType:'text/plain',buffer:Buffer.from('A short source review sample.')});
 await expect(page.locator('#publication-text')).toHaveValue('A short source review sample.');await expect(page.locator('#report-title')).toHaveValue('Chosen publication title');
});
