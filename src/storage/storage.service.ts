import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async saveBase64Image(dataUri: string, folder: string): Promise<string> {
    if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
      return dataUri;
    }

    try {
      const matches = dataUri.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return dataUri;
      }

      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${randomUUID()}.webp`;
      
      const targetDir = path.join(this.uploadsDir, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const optimizedBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const filePath = path.join(targetDir, filename);
      await fs.promises.writeFile(filePath, optimizedBuffer);
      
      return `/uploads/${folder}/${filename}`;
    } catch (error) {
      this.logger.error(`Failed to save base64 image: ${(error as Error).message}`);
      return dataUri; // Fallback to original string if saving fails
    }
  }
}
