import { parentPort } from 'worker_threads';
import { createHash } from 'crypto';

function hashString(str) {
    return createHash('md5').update(str).digest('hex');
}

function getTotalWordsCount(alphabet, maxLength) {
    let total = 0;
    for (let length = 1; length <= maxLength; ++length) {
        total += Math.pow(alphabet.length, length);
    }
    return total;
}

function generateWordFromIndex(alphabet, maxLength, index) {
    let word = '';
    let alphabetSize = alphabet.length;

    // Определяем длину слова
    let length = 1;
    let relativeIndex = index;

    while (relativeIndex >= Math.pow(alphabetSize, length)) {
        relativeIndex -= Math.pow(alphabetSize, length)
        length++;
    }

    // Вычисляем индекс внутри слов данной длины
    for (let i = 0; i < length; i++) {
        let letterIndex = relativeIndex % alphabetSize;
        word = alphabet[letterIndex] + word;
        relativeIndex = Math.floor(relativeIndex / alphabetSize);
    }
    return word;
}

async function hardWork(hash, maxLength, alphabet, partNumber, partCount, requestId) {
    const totalWords = getTotalWordsCount(alphabet, maxLength);
    const range = {
        start: Math.floor((partNumber - 1) * totalWords / partCount),
        end: Math.floor(partNumber * totalWords / partCount)
    };

    let found = [];

    for (let i = range.start; i < range.end; i++) {
        const word = generateWordFromIndex(alphabet, maxLength, i);
        if (hashString(word) === hash) {
            found.push(word);
        }
    }

    parentPort.postMessage({ found, requestId, status: 'READY' }); // Отправляем результат обратно в основной поток
}

// Принимаем сообщение из основного потока
parentPort.on('message', (data) => {
    const { hash, maxLength, alphabet, partNumber, partCount, requestId } = data;
    hardWork(hash, maxLength, alphabet, partNumber, partCount, requestId);
});
