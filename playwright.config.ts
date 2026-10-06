import {defineConfig,devices} from '@playwright/test';
const baseURL=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3001';
export default defineConfig({testDir:'./tests/browser',workers:2,timeout:60000,use:{baseURL,screenshot:'only-on-failure'},webServer:{command:'npm run dev',url:baseURL,reuseExistingServer:!process.env.CI},projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]});
