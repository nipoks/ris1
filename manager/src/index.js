import express from 'express';
import dotenv from 'dotenv';
import { AppRoutes } from "./routes.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(AppRoutes);

app.listen(3000, () => {
    console.log("Запущен на порту 3000");
});
