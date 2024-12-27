const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
const PORT = 5000;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const upload = multer({ dest: 'uploads/' });

const MAX_FILE_SIZE = 980 * 1024;
const AUDIO_BITRATE = 128;

app.post('/convert', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }

    const inputFilePath = req.file.path;
    const outputFilePath = `uploads/${path.parse(req.file.originalname).name}.mp4`;

    ffmpeg.ffprobe(inputFilePath, (err) => {
        if (err) {
            console.error('Error retrieving video metadata:', err);
            fs.unlinkSync(inputFilePath);
            return res.status(500).send('Error processing video');
        }

        const videoBitrate = 142;

        ffmpeg(inputFilePath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .outputOptions([
                `-b:v ${videoBitrate}k`,        // Video bitrate
                `-b:a ${AUDIO_BITRATE}k`,       // Audio bitrate
                '-preset veryslow',             // Slower preset for better compression efficiency
                '-crf 26',                      // Constant Rate Factor (lower means better quality, default: 23)
                '-movflags +faststart',         // Optimize MP4 for streaming
                '-profile:v high',              // Use high profile for better quality at lower bitrate
                '-pix_fmt yuv420p',             // Pixel format compatible with most devices
            ])
            .on('end', () => {
                const fileSize = fs.statSync(outputFilePath).size;
                if (fileSize > MAX_FILE_SIZE) {
                    console.log(fileSize);
                    fs.unlinkSync(outputFilePath);
                    res.status(400).send('Unable to compress video under 1MB');
                } else {
                    res.download(outputFilePath, (err) => {
                        if (err) {
                            console.error(err);
                        }
                        fs.unlinkSync(inputFilePath);
                        fs.unlinkSync(outputFilePath);
                    });
                }
            })
            .on('error', (err) => {
                console.error('Error during conversion:', err);
                res.status(500).send('Error during conversion');
                fs.unlinkSync(inputFilePath);
            })
            .save(outputFilePath);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
