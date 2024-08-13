import express from 'express';
import bodyParser from 'body-parser';
import { classifyHs } from './classifyHs'; // Import your classification function

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

app.post('/classify-hs', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const classification = await classifyHs(message);

        res.json({ classification });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
