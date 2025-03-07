import express from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const WORKERS = ['http://worker1:4000', 'http://worker2:4000', 'http://worker3:4000'];
let requests = {};
const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

function splitWork(alphabet, maxLength, numWorkers) {
    const totalCombinations = Math.pow(alphabet.length, maxLength);
    const step = Math.ceil(totalCombinations / numWorkers);
    let ranges = [];
    for (let i = 0; i < numWorkers; i++) {
        let start = i * step;
        let end = Math.min(start + step, totalCombinations);
        ranges.push({ start, end });
    }
    return ranges;
}

app.post("/api/hash/crack", async (req, res) => {
    const { hash, maxLength } = req.body;
    if (!hash || !maxLength) {
        return res.status(400).json({ error: "Missing parameters" });
    }

    const requestId = uuidv4();

    console.log(`Новый запрос: ${requestId}`);

    let workerTasks = splitWork(alphabet, maxLength, WORKERS.length);

    let promises = workerTasks.map((range, index) => {
        requests[requestId + (index + 1)] = {
            status: 'PENDING',
            found: null
        };
        return axios.post(`${WORKERS[index]}/internal/api/worker/hash/crack/task`, {
            hash,
            maxLength,
            alphabet,
            partNumber: index + 1,
            partCount: WORKERS.length,
            requestId: requestId
        })
            .then(response => {
                requests[requestId + (index + 1)].status = 'IN_PROGRESS';
                requests[requestId + (index + 1)].found = [''];
            })
            .catch(error => {
                console.error(`Ошибка при отправки задачи воркеру ${index + 1}:`, error.response?.data || error.message);
            });
    });
    res.json({ requestId });
});

app.get("/api/hash/status", (req, res) => {
    const { requestId } = req.query;
    if (!requestId || !requests[requestId + 1]) {
        return res.status(400).json({ error: "Invalid requestId" });
    }
    let countReady = 0
    let countError = 0
    let answer = []

    for (let i = 1; i <= WORKERS.length; i++) {
        const status = requests[requestId + i].status;
        switch (status) {
            case 'IN_PROGRESS':    // хоть 1 InProgress - в ответ IP
                return res.json({
                    status: 'IN_PROGRESS',
                    data: null
                });
            case 'READY':
                countReady += 1
                const answerI = requests[requestId + i].found
                if (answerI !== null) {
                    answer.push(answerI)
                }
                break;
            case 'ERROR':
                countError += 1
                break;
            default:
                break;
        }
    }

    if (countReady === WORKERS.length) {
        return res.json({
            status: 'READY',
            data: answer
        });
    }

    if (countError > 0) {
        if (answer.length > 0) { // если есть error но хоть 1 ответ не пустой - ответ PART_ANSWER_IS_READY 'abcd'
            return res.json({
                status: 'PART_ANSWER_IS_READY',
                data: answer
            });
        }

        return res.json({
            status: 'ERROR',
            data: null
        });
    }

    return res.json({
        status: 'I_D\'NOT_NO',
        data: null
    });
});

app.patch("/internal/api/manager/hash/crack/request",(req, res) => {
    const { partNumber, found, requestId, status } = req.body;

    if (partNumber === undefined || found === undefined) {
        return res.status(400).json({ error: "Invalid result data" });
    }

    console.log(`Получен результат от Worker ${partNumber}: ${found ? found : "ничего не найдено"}`);
    requests[requestId + partNumber].found = found;
    requests[requestId + partNumber].status = status;
    res.status(200).json({ message: "Результат принят" });
})

app.listen(3000, () => {
    console.log("Запущен на порту 3000");
});
