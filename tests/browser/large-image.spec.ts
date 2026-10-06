import {test,expect} from '@playwright/test';
test('large image prepares a bounded analysis copy while preserving the uploaded original',async({page})=>{
 let sent=0;await page.route('**/api/content/image',r=>{sent=r.request().postDataBuffer()!.length;return r.fulfill({json:{units:[]}});});
 await page.goto('/?app=content&lang=en');await page.getByRole('button',{name:'Image',exact:true}).click();
 const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=1600;const g=c.getContext('2d')!,im=g.createImageData(1600,1600);for(let i=0;i<im.data.length;i+=4){const n=Math.floor(Math.random()*0xffffff);im.data[i]=n&255;im.data[i+1]=(n>>>8)&255;im.data[i+2]=(n>>>16)&255;im.data[i+3]=255;}g.putImageData(im,0,0);return c.toDataURL().split(',')[1];});
 const buffer=Buffer.from(data,'base64');expect(buffer.length).toBeGreaterThan(3*1024*1024);
 await page.locator('input[type=file]').setInputFiles({name:'large-poster.png',mimeType:'image/png',buffer});await expect.poll(()=>sent).toBeGreaterThan(0);expect(sent).toBeLessThanOrEqual(3*1024*1024);await expect(page.getByRole('img',{name:'Original content',exact:true})).toBeVisible();await expect(page.getByText('Saved on this device',{exact:true})).toBeVisible();
});
