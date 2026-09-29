import app from './app';
import { ENV } from './config/env';

const PORT = parseInt(ENV.PORT, 10);

app.listen(PORT, () => {
  console.log(`Backend is Running on — port ${PORT}`);
});
