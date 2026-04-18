import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  try {
    const backendUrl = process.env.BACKEND_API_URL || 'http://backend-api:8000';
    const response = await fetch(`${backendUrl}/api/machine/${id}`, { cache: 'no-store' });
    
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch machine" }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 500 });
  }
}
