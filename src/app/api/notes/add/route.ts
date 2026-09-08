import { NextRequest } from "next/server";
import { redirectAfterPost } from "@/lib/redirect";
import { addNote, addActivity, getUserByEmail } from "@/lib/db.mjs";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const content = String(form.get("content") || "").trim();
  const jobId = parseInt(String(form.get("jobId") || "0"), 10);
  const userId = parseInt(String(form.get("userId") || "0"), 10);
  if (!content || !jobId || !userId) return redirectAfterPost("/jobs/" + jobId);

  addNote({ content, createdBy: userId, jobId });
  addActivity({ description: "Added note", byUserId: userId, jobId });

  return redirectAfterPost("/jobs/" + jobId);
}
