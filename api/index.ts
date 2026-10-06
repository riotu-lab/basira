import {createApp} from '../server/app.js';
// Vercel owns the HTTP listener. Browser media connects directly to LiveAvatar.
export default createApp().app;
