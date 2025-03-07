import express from 'express';
import { Worker } from 'worker_threads';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(express.json());

let activeWorkers = 0;
let taskQueue = [];

function handleTaskQueue() {
    if (taskQueue.length > 0 && activeWorkers < 2) {
        const task = taskQueue.shift();
        activeWorkers++;
        processTask(task);
    }
}

async function processTask(task) {
    const { hash, maxLength, alphabet, partNumber, partCount, requestId } = task;

    const worker = new Worker('./worker.js');
    worker.postMessage({ hash, maxLength, alphabet, partNumber, partCount, requestId });

    worker.on('message', async (data) => {
        const { found, requestId, status } = data;

        console.log(`Завершил обработку задачи ${requestId}. Найдено: ${found.length > 0 ? found : 'ничего'}`);
        try {
            await axios.patch("http://manager:3000/internal/api/manager/hash/crack/request", {
                partNumber,
                found: found.length > 0 ? found : null,
                requestId: requestId,
                status: status
            });
            console.log(`Результат для задачи ${requestId} отправлен.`);
        } catch (error) {
            console.error(`Ошибка отправки результата задачи ${requestId}: ${error.message}`);
        }

        --activeWorkers;
        handleTaskQueue();
    });

    worker.on('error', (error) => {
        console.error(`Ошибка в worker для задачи ${requestId}: ${error.message}`);
        activeWorkers--;
        handleTaskQueue();
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker завершился с ошибкой для задачи ${requestId}, код: ${code}`);
        }
    });
}

app.post("/internal/api/worker/hash/crack/task", async (req, res) => {
    const { hash, maxLength, alphabet, partNumber, partCount, requestId } = req.body;

    if (!hash || !alphabet || !maxLength || !partNumber || !partCount || !requestId) {
        return res.status(400).json({ error: "Invalid task data" });
    }

    console.log(`Получена задача: ${requestId}`);

    if (activeWorkers < 2) {
        ++activeWorkers;
        processTask({ hash, maxLength, alphabet, partNumber, partCount, requestId });
        console.log(`Задача ${requestId} отправлена на выполнение.`);
    } else {
        taskQueue.push({ hash, maxLength, alphabet, partNumber, partCount, requestId });
        console.log(`Задача ${requestId} поставлена в очередь.`);
    }

    return res.status(200).json({ message: "Работа запущена" });
});

app.listen(4000, () => {
    console.log("Запущен на порту 4000");
});
