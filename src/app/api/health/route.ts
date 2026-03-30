export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json({
    status: "ok",
    message: "QBH MVP backend is running"
  });
}
