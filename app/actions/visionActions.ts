'use server'

import { db } from '@/db';
import { ideas } from '@/db/schema';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';

export async function saveToHangar(formData: {
    title: string;
    hook: string;
    content: string;
    category: string;
    userId: string;
}) {
    const seed = formData.userId + formData.content + Date.now().toString();
    const genesisCode = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 12);

    try {
        const result = await db.insert(ideas).values({
            title: formData.title,
            hook: formData.hook,
            content: formData.content,
            category: formData.category,
            userId: formData.userId,
            genesisCode,
            status: 'draft',
            totalLikes: 0,
        }).returning();

        revalidatePath('/hangar');
        return { success: true, genesisCode: result[0].genesisCode };
    } catch (error) {
        console.error("Save Failed:", error);
        return { success: false, error: "Database rejected the idea." };
    }
}
