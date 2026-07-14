"use server";

import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";

import { z } from "zod";

import { requirePermission } from "@/server/auth/guards";

import { bannerCreateInputSchema, bannerDeleteInputSchema, bannerUpdateInputSchema, heroSettingsUpdateInputSchema } from "./schemas";
import * as designService from "./service";

export interface DesignActionState {
  success: boolean;
  message: string;
}

function formValue(formData: FormData, key: string): FormDataEntryValue | null {
  return formData.get(key);
}

function optionalStringValue(formData: FormData, key: string): string | undefined {
  const value = formValue(formData, key);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function checkboxValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function errorState(error: unknown): DesignActionState {
  if (isRedirectError(error)) {
    throw error;
  }

  if (error instanceof z.ZodError) {
    return { success: false, message: error.issues[0]?.message ?? "Invalid input." };
  }

  console.error("Design action failed:", error);
  return { success: false, message: "The operation could not be completed." };
}

export async function createBanner(formData: FormData): Promise<DesignActionState> {
  const user = await requirePermission("design:write");

  try {
    const input = bannerCreateInputSchema.parse({
      title: formValue(formData, "title"),
      subtitle: optionalStringValue(formData, "subtitle"),
      imagePath: formValue(formData, "imagePath"),
      linkUrl: optionalStringValue(formData, "linkUrl"),
      displayOrder: formValue(formData, "displayOrder"),
      isActive: checkboxValue(formData, "isActive"),
      startDate: optionalStringValue(formData, "startDate"),
      endDate: optionalStringValue(formData, "endDate"),
    });

    await designService.createBanner(input, user.id);
    revalidatePath("/admin/design");
    redirect("/admin/design?success=banner-created");
  } catch (error) {
    return errorState(error);
  }
}

export async function updateHeroSettings(formData: FormData): Promise<DesignActionState> {
  const user = await requirePermission("design:write");

  try {
    const input = heroSettingsUpdateInputSchema.parse({
      backgroundImage: formValue(formData, "backgroundImage"),
      title: formValue(formData, "title"),
      subtitle: formValue(formData, "subtitle"),
      ctaText: formValue(formData, "ctaText"),
      ctaLink: formValue(formData, "ctaLink"),
    });

    await designService.updateHeroSettings(input, user.id);
    revalidatePath("/admin/design");
    redirect("/admin/design?success=hero-updated");
  } catch (error) {
    return errorState(error);
  }
}

export async function updateBanner(formData: FormData): Promise<DesignActionState> {
  await requirePermission("design:write");

  try {
    const input = bannerUpdateInputSchema.parse({
      id: formValue(formData, "id"),
      title: formValue(formData, "title"),
      subtitle: optionalStringValue(formData, "subtitle"),
      imagePath: formValue(formData, "imagePath"),
      linkUrl: optionalStringValue(formData, "linkUrl"),
      displayOrder: formValue(formData, "displayOrder"),
      isActive: checkboxValue(formData, "isActive"),
      startDate: optionalStringValue(formData, "startDate"),
      endDate: optionalStringValue(formData, "endDate"),
    });

    await designService.updateBanner(input);
    revalidatePath("/admin/design");
    redirect("/admin/design?success=banner-updated");
  } catch (error) {
    return errorState(error);
  }
}

export async function deleteBanner(formData: FormData): Promise<DesignActionState> {
  await requirePermission("design:write");

  try {
    const input = bannerDeleteInputSchema.parse({ id: formValue(formData, "id") });

    await designService.deleteBanner(input.id);
    revalidatePath("/admin/design");
    redirect("/admin/design?success=banner-deleted");
  } catch (error) {
    return errorState(error);
  }
}
