// =====================================================
// Scraper HTTP istemcisi — tarayici benzeri header'lar + anti-ban
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

@Injectable()
export class ScraperHttpClient {
  private readonly logger = new Logger(ScraperHttpClient.name);

  constructor(private readonly config: ConfigService) {}

  private buildHeaders(accept: string, url: string) {
    let origin = 'https://www.google.com/';
    try {
      origin = new URL(url).origin + '/';
    } catch {
      // gecersiz URL
    }

    return {
      'User-Agent': this.config.get<string>(
        'scraper.userAgent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      ),
      Accept: accept,
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      Referer: origin,
      Origin: origin.replace(/\/$/, ''),
      'Sec-Fetch-Dest': accept.includes('xml') ? 'empty' : 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  private timeout() {
    return this.config.get<number>('scraper.requestTimeoutMs', 15000);
  }

  async fetchText(url: string): Promise<string> {
    const isXml = url.includes('sitemap') || url.endsWith('.xml');
    const accept = isXml
      ? 'application/xml,text/xml,application/xhtml+xml;q=0.9,*/*;q=0.8'
      : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

    try {
      const response = await axios.get<string>(url, {
        headers: this.buildHeaders(accept, url),
        timeout: this.timeout(),
        responseType: 'text',
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      this.logger.warn(`HTTP hata (${status ?? 'network'}): ${url}`);
      throw err;
    }
  }

  async fetchJson<T>(url: string): Promise<T> {
    try {
      const response = await axios.get<T>(url, {
        headers: this.buildHeaders('application/json, text/plain, */*', url),
        timeout: this.timeout(),
        validateStatus: (status) => status >= 200 && status < 300,
      });
      return response.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      this.logger.warn(`JSON API hata (${status ?? 'network'}): ${url}`);
      throw err;
    }
  }
}
