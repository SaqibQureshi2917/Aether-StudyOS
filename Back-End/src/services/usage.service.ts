import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';

export class UsageService {
  async checkAndUpdateUsage(userId: string): Promise<{ used: number; limit: number }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { planType: true },
    });

    const isPro = user?.planType === 'PRO';
    const limit = isPro ? 500 : 20;

    const usageTracker = await prisma.usageTracker.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const currentUsage = usageTracker.aiQueriesUsed;

    if (currentUsage >= limit) {
      throw new AppError("You've reached your monthly AI limit. Please upgrade to Pro.", 403);
    }

    await prisma.usageTracker.update({
      where: { userId },
      data: { aiQueriesUsed: { increment: 1 } },
    });

    return { used: currentUsage + 1, limit };
  }
}

export const usageService = new UsageService();