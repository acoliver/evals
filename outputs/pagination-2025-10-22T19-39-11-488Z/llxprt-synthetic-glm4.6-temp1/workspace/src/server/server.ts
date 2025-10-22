import { createApp } from './app';

const PORT = Number(process.env.PORT ?? 3333);

createApp()
  .then((app) => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exitCode = 1;
  });
