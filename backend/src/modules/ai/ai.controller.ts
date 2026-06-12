import { Controller, Post, Get, Body, Param, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { AiService } from './ai.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly jwtService: JwtService,
  ) {}

  @Public()
  @Post('search')
  @ApiOperation({ summary: 'Dogal dil ile akilli urun arama' })
  naturalLanguageSearch(@Body() body: { query: string }) {
    return this.aiService.naturalLanguageSearch(body.query);
  }

  @Public()
  @Get('price-trend/:productId/:marketId')
  @ApiOperation({ summary: 'Urun fiyat trendi tahmini' })
  predictPriceTrend(
    @Param('productId') productId: string,
    @Param('marketId') marketId: string,
  ) {
    return this.aiService.predictPriceTrend(productId, marketId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('recommendations')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kisisellestirilmis urun onerileri' })
  getRecommendations(@CurrentUser() user: AuthenticatedUser) {
    return this.aiService.generateRecommendations(user.id);
  }

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'AI asistan durumu (LLM aktif mi?)' })
  getStatus() {
    const status = this.aiService.getLlmStatus();
    let hint = 'ChatGPT tarzı sohbet aktif';
    if (!status.llm) {
      if (status.geminiConfigured && !status.geminiKeyValid) {
        hint = 'GEMINI_API_KEY tanınmadı — Google AI Studio key (AIza... veya AQ....) kullanın';
      } else {
        hint = 'GEMINI_API_KEY ekleyin — scripts/setup-gemini-key.ps1';
      }
    }
    return { ...status, hint };
  }

  @Public()
  @Post('chat')
  @ApiOperation({
    summary: 'Kapsamlı AI asistan (ürün + uygulama + kullanıcı + konum)',
    description: 'Giriş opsiyonel. Konum (lat/lng) yakın market soruları için önerilir. OPENAI/GEMINI key varsa serbest sohbet.',
  })
  chat(
    @Body() dto: AiChatDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-session-id') sessionId?: string,
  ) {
    const message = dto.message?.trim();
    if (!message) {
      return { response: 'Lütfen bir soru yazın.' };
    }

    let userId: string | undefined;
    if (authorization?.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.verify<{ sub: string }>(authorization.slice(7));
        userId = payload.sub;
      } catch {
        // misafir devam eder
      }
    }

    return this.aiService.chat(message, dto.history ?? [], {
      userId,
      sessionId,
      latitude: dto.latitude,
      longitude: dto.longitude,
    }).then((response) => ({ response }));
  }
}
