import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  error?: string;
  title?: string;
}

export interface MediaRequest {
  platform: 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'facebook' | 'unknown';
  url?: string;
  query?: string;
  mediaType: 'audio' | 'video';
}

const TEMP_DIR = '/tmp/media_downloads';
const MAX_FILE_SIZE = 15 * 1024 * 1024;

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function cleanupOldFiles(): void {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.error('Error cleaning up old files:', err);
  }
}

setInterval(cleanupOldFiles, 5 * 60 * 1000);

export function extractYouTubeUrl(text: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  }
  return null;
}

export function extractTikTokUrl(text: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
    /(?:https?:\/\/)?(?:vm\.)?tiktok\.com\/[\w]+/,
    /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/[\w]+/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

export function extractInstagramUrl(text: string): string | null {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

export function detectPlatform(text: string): MediaRequest['platform'] {
  if (text.includes('youtube.com') || text.includes('youtu.be')) return 'youtube';
  if (text.includes('tiktok.com') || text.includes('vm.tiktok')) return 'tiktok';
  if (text.includes('instagram.com')) return 'instagram';
  if (text.includes('twitter.com') || text.includes('x.com')) return 'twitter';
  if (text.includes('facebook.com') || text.includes('fb.watch')) return 'facebook';
  return 'unknown';
}

export async function downloadYouTubeAudio(url: string): Promise<DownloadResult> {
  cleanupOldFiles();
  
  try {
    if (!ytdl.validateURL(url)) {
      return { success: false, error: 'رابط يوتيوب غير صالح' };
    }
    
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s\u0600-\u06FF-]/g, '').substring(0, 50);
    const duration = parseInt(info.videoDetails.lengthSeconds);
    
    if (duration > 600) {
      return { success: false, error: 'المقطع طويل جداً (أكثر من 10 دقائق). جرب مقطع أقصر.' };
    }
    
    const fileName = `${Date.now()}_${title}.mp3`;
    const outputPath = path.join(TEMP_DIR, fileName);
    
    return new Promise((resolve) => {
      const audioStream = ytdl(url, {
        quality: 'lowestaudio',
        filter: 'audioonly',
      });
      
      ffmpeg(audioStream)
        .audioBitrate(128)
        .format('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          resolve({ success: false, error: 'فشل في تحويل الصوت. حاول مرة أخرى.' });
        })
        .on('end', () => {
          const stats = fs.statSync(outputPath);
          if (stats.size > MAX_FILE_SIZE) {
            fs.unlinkSync(outputPath);
            resolve({ success: false, error: 'الملف كبير جداً. جرب مقطع أقصر.' });
            return;
          }
          
          resolve({
            success: true,
            filePath: outputPath,
            fileName: `${title}.mp3`,
            mimeType: 'audio/mpeg',
            title: info.videoDetails.title,
          });
        })
        .save(outputPath);
    });
  } catch (err: any) {
    console.error('YouTube download error:', err);
    
    if (err.message?.includes('Video unavailable')) {
      return { success: false, error: 'الفيديو غير متاح أو محذوف' };
    }
    if (err.message?.includes('age-restricted')) {
      return { success: false, error: 'هذا المحتوى مقيد بالعمر ولا يمكن تحميله' };
    }
    if (err.message?.includes('private')) {
      return { success: false, error: 'هذا الفيديو خاص ولا يمكن الوصول إليه' };
    }
    
    return { success: false, error: 'فشل في تحميل المحتوى. تأكد من صحة الرابط.' };
  }
}

export async function downloadYouTubeVideo(url: string): Promise<DownloadResult> {
  cleanupOldFiles();
  
  try {
    if (!ytdl.validateURL(url)) {
      return { success: false, error: 'رابط يوتيوب غير صالح' };
    }
    
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s\u0600-\u06FF-]/g, '').substring(0, 50);
    const duration = parseInt(info.videoDetails.lengthSeconds);
    
    if (duration > 180) {
      return { success: false, error: 'الفيديو طويل جداً (أكثر من 3 دقائق). جرب فيديو أقصر أو اطلب صوت فقط.' };
    }
    
    const fileName = `${Date.now()}_${title}.mp4`;
    const outputPath = path.join(TEMP_DIR, fileName);
    
    return new Promise((resolve) => {
      const videoStream = ytdl(url, {
        quality: 'lowest',
        filter: (format) => format.container === 'mp4' && format.hasVideo && format.hasAudio,
      });
      
      let downloadedSize = 0;
      const writeStream = fs.createWriteStream(outputPath);
      
      videoStream.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (downloadedSize > MAX_FILE_SIZE) {
          videoStream.destroy();
          writeStream.close();
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          resolve({ success: false, error: 'الفيديو كبير جداً. جرب طلب صوت فقط.' });
        }
      });
      
      videoStream.pipe(writeStream);
      
      writeStream.on('finish', () => {
        resolve({
          success: true,
          filePath: outputPath,
          fileName: `${title}.mp4`,
          mimeType: 'video/mp4',
          title: info.videoDetails.title,
        });
      });
      
      videoStream.on('error', (error: Error) => {
        console.error('Video stream error:', error);
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        resolve({ success: false, error: 'فشل في تحميل الفيديو. حاول مرة أخرى.' });
      });
    });
  } catch (err: any) {
    console.error('YouTube video download error:', err);
    return { success: false, error: 'فشل في تحميل الفيديو. تأكد من صحة الرابط.' };
  }
}

export async function searchAndDownloadYouTube(query: string, mediaType: 'audio' | 'video' = 'audio'): Promise<DownloadResult> {
  return { 
    success: false, 
    error: 'للتحميل، أرسل رابط يوتيوب مباشرة. مثال:\nحمل: https://youtube.com/watch?v=xxxxx' 
  };
}

export function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Error cleaning up file:', err);
  }
}
