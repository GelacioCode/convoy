import 'dotenv/config';
import { createApp } from './src/app.js';

const port = Number(process.env.PORT ?? 3001);
const app = createApp();

app.listen(port, () => {
  console.log(`[convoy] backend listening on http://localhost:${port}`);
});
