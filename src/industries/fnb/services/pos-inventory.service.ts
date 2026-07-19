import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PosInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deducts stock for a list of order items
   * and creates stock logs.
   * Runs within the provided Prisma transaction (tx).
   */
  async deductStockForOrderItems(
    tenantId: string,
    orderItems: { productId: string; quantity: number }[],
    tx: any, // Prisma.TransactionClient
    orderId: string,
    branchId?: string | null,
  ) {
    // 1. Group required quantities per product
    const productQuantities: Record<string, number> = {};
    for (const item of orderItems) {
      if (!productQuantities[item.productId]) {
        productQuantities[item.productId] = 0;
      }
      productQuantities[item.productId] += item.quantity;
    }

    // 2. Fetch recipes for these products
    const productIds = Object.keys(productQuantities);
    const recipes = await tx.posRecipe.findMany({
      where: {
        productId: { in: productIds },
        product: { tenantId },
      },
      include: {
        items: true,
      },
    });

    // 3. Calculate total ingredient deduction map
    const ingredientDeductions: Record<string, number> = {};
    for (const recipe of recipes) {
      const soldQuantity = productQuantities[recipe.productId] || 0;
      for (const recipeItem of recipe.items) {
        if (!ingredientDeductions[recipeItem.ingredientId]) {
          ingredientDeductions[recipeItem.ingredientId] = 0;
        }
        ingredientDeductions[recipeItem.ingredientId] += (Number(recipeItem.quantityRequired) * soldQuantity);
      }
    }

    // 4. Execute deduction and log
    for (const [ingredientId, amountToDeduct] of Object.entries(ingredientDeductions)) {
      // Fetch current stock
      const ingredient = await tx.posIngredient.findUnique({
        where: { id: ingredientId },
      });
      if (!ingredient) continue;

      const finalStock = Number(ingredient.currentStock) - amountToDeduct;

      // Update ingredient
      await tx.posIngredient.update({
        where: { id: ingredientId },
        data: { currentStock: finalStock },
      });

      // Create log
      await tx.posStockLog.create({
        data: {
          tenantId,
          branchId: branchId ?? null,
          ingredientId,
          changeAmount: -amountToDeduct,
          finalStock,
          movementType: 'OUT',
          reason: 'SALES',
          notes: `Deducted from Order: ${orderId}`,
        },
      });
    }
  }
}
