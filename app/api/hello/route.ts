import { getHelloMessage } from "@/lib/server/modules/hello";
import { successResponse } from "@/lib/server/utils/response";

export async function GET() {
  const data = await getHelloMessage();
  return successResponse(data);
}
