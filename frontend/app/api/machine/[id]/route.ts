import { NextResponse } from 'next/server';

// This is a stub for the Hindsight MCP Server Integration
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  // In a real scenario, we would forward this request to the Hindsight Server
  // e.g. const response = await fetch(`${process.env.HINDSIGHT_URL}/graphs/entity/${id}`);
  
  // Simulated database lookup delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Simulated fallback response
  const mockData = {
    id: id,
    name: "Thyssenkrupp Stacker-Reclaimer #04",
    serialNumber: `TK-SR-04-${id}`,
    commissioningDate: "1998-10-15",
    type: "Material Handling",
    location: "Zone A, Port Headland",
    status: "Operational",
    backendSource: "hindsight-mcp-stub"
  };

  return NextResponse.json(mockData);
}
