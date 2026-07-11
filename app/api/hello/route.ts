import { getHelloMessage, successResponse } from "@/lib/server";

export async function GET() {
  const data = await getHelloMessage();
  return successResponse(data);
}
