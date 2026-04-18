import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import models
from database import engine

logger = logging.getLogger("koch-backend-seed")

async def init_db():
    async with engine.begin() as conn:
        # Create all tables if they don't exist
        await conn.run_sync(models.Base.metadata.create_all)

async def seed_data_if_empty(session: AsyncSession):
    # Check if there's any manual
    result = await session.execute(select(models.Manual).limit(1))
    manual_exists = result.scalars().first() is not None

    vf_result = await session.execute(select(models.VaultFile).limit(1))
    vf_exists = vf_result.scalars().first() is not None

    if manual_exists and vf_exists:
        return # Db already seeded

    logger.info("Database missing some seed data. Seeding...")

    # Seeding Manuals
    manuals = [
        models.Manual(id="M-A01", title="Stacker Reclaimer SR-04 Setup Guide", category="Installation", machine="SR-04", date="Oct 12, 2025", pages=142),
        models.Manual(id="M-B22", title="Conveyor C-11 Routine Maintenance", category="Maintenance", machine="CV-11", date="Nov 04, 2025", pages=48),
        models.Manual(id="M-C31", title="Centrifugal Pump P-03 Overhaul", category="Repair", machine="P-03", date="Jan 15, 2026", pages=215),
        models.Manual(id="M-D05", title="Drive System DS-01 Specifications", category="Datasheet", machine="DS-01", date="Feb 22, 2026", pages=12),
        models.Manual(id="M-E19", title="Automated Guided Vehicle AGV-2 Safety", category="Safety", machine="AGV-02", date="Mar 01, 2026", pages=84),
        models.Manual(id="M-F44", title="Heavy Duty Crusher HC-09 Operations", category="Operations", machine="HC-09", date="Mar 18, 2026", pages=310),
    ]

    # Seeding BOM Items
    boms = [
        models.BomItem(id="MTR-402", name="Main Drive Motor", material="Cast Iron", quantity=1, status="Verified"),
        models.BomItem(id="SHF-099", name="Drive Shaft", material="Steel Alloy", quantity=1, status="Verified"),
        models.BomItem(id="BRG-221", name="Slewing Bearing", material="Steel", quantity=2, status="Critical Tolerance"),
        models.BomItem(id="PLT-100", name="Mounting Plate", material="Aluminum", quantity=4, status="Pending Review"),
    ]

    # Seeding Anomalies
    anomalies = [
        models.Anomaly(id="A-01", severity="high", description="Clearance violation detected at stator assembly."),
        models.Anomaly(id="A-02", severity="medium", description="Material specification mismatch on Mounting Plate.")
    ]

    # Seeding Procurement Parts
    parts = [
        models.ProcurementPart(id="PN-88219", description="Bearing Seal Kit (High Temp)", supplier="Rexnord", leadTime="3 Days", risk="Low", status="Available", price="$240.00"),
        models.ProcurementPart(id="PN-44102", description="Slewing Ring Assembly", supplier="SKF", leadTime="14 Weeks", risk="High", status="Sourced", price="$14,500.00"),
        models.ProcurementPart(id="PN-09931", description="Primary Conveyor Belt (200m)", supplier="Fenner Dunlop", leadTime="6 Weeks", risk="Medium", status="Pending", price="$8,200.00"),
        models.ProcurementPart(id="PN-77510", description="VFD Drive Module 250kW", supplier="ABB", leadTime="2 Weeks", risk="Low", status="Available", price="$3,150.00"),
        models.ProcurementPart(id="PN-11048", description="Hydraulic Cylinder 80x40x600", supplier="Bosch Rexroth", leadTime="8 Weeks", risk="High", status="Critical", price="$1,890.00"),
        models.ProcurementPart(id="PN-33290", description="Lubrication Pump", supplier="Lincoln", leadTime="1 Week", risk="Low", status="Available", price="$850.00"),
        models.ProcurementPart(id="PN-55811", description="Proximity Sensor Kit", supplier="Sick", leadTime="4 Days", risk="Low", status="Pending", price="$320.00"),
    ]

    # Seeding Telemetry Nodes
    nodes = [
        models.TelemetryNode(id="NODE-A1", status="online", load=24, latency=4, desc="Primary Inference Endpoint"),
        models.TelemetryNode(id="NODE-A2", status="online", load=68, latency=12, desc="Secondary Inference Endpoint"),
        models.TelemetryNode(id="NODE-B1", status="warning", load=92, latency=45, desc="Retrieval Augmented DB Search"),
        models.TelemetryNode(id="NODE-C1", status="offline", load=0, latency=0, desc="Legacy Archive Gateway"),
    ]

    # Seeding Field Threads and Messages
    threads = [
        models.FieldThread(id="FT-1042", title="Overheating bearing #3", name="J. Miller", time="10m ago", status="active", unread=True),
        models.FieldThread(id="FT-1041", title="Lubrication system failure", name="S. Rossi", time="1h ago", status="active", unread=False),
        models.FieldThread(id="FT-1040", title="Calibration parameters", name="A. Chen", time="3h ago", status="resolved", unread=False),
        models.FieldThread(id="FT-1038", title="Vibration anomaly detected", name="System", time="1d ago", status="resolved", unread=False),
    ]

    messages = [
        models.FieldMessage(thread_id="FT-1042", sender="technician", name="J. Miller", text="Hey, I'm at the primary conveyor. The sleeve bearing on idler #3 is running about 40 degrees above baseline. Smells like burnt grease.", time="10:02 AM"),
        models.FieldMessage(thread_id="FT-1042", sender="ai", name="Koch AI Assistant", text="I've pulled the telemetry for idler #3. You are correct, temperature spiked 45 minutes ago. Historical data suggests the seal might have ruptured. Have you checked the outer seal for leakage?", time="10:03 AM", isInsight=True),
        models.FieldMessage(thread_id="FT-1042", sender="technician", name="J. Miller", text="Checking now. Give me a sec.", time="10:05 AM"),
        models.FieldMessage(thread_id="FT-1042", sender="technician", name="J. Miller", text="Yeah, there's grease blowout all over the housing. Definitely a seal failure.", time="10:12 AM"),
        models.FieldMessage(thread_id="FT-1042", sender="ai", name="Koch AI Assistant", text="Logging diagnostic: Seal Rupture on Idler #3. I've initiated a draft order for replacement kit PN-88219 from the warehouse. Should I dispatch a secondary team with rigging gear?", time="10:13 AM")
    ]

    # Seeding Machine Data
    machines = [
        models.Machine(id="MCH-001", name="Thyssenkrupp Stacker-Reclaimer #04", serialNumber="TK-SR-04-1998", commissioningDate="1998-10-15", type="Material Handling", location="Zone A, Port Headland", status="Operational")
    ]

    timeline_events = [
        models.TimelineEvent(machine_id="MCH-001", year="2024", title="Routine Maintenance Log", desc="Replaced primary conveyor belt drive bearings.", type="Maintenance"),
        models.TimelineEvent(machine_id="MCH-001", year="2020", title="Structural Audit", desc="Passed 20-year structural integrity scan.", type="Safety"),
        models.TimelineEvent(machine_id="MCH-001", year="2015", title="Drive Motor Upgrade Specs", desc="Upgraded main boom motor from 250kW to 300kW.", type="Upgrade"),
        models.TimelineEvent(machine_id="MCH-001", year="1998", title="Original Construction Docs", desc="Commissioning blueprints and P&IDs.", type="Construction")
    ]

    doc_categories = [
        models.DocumentCategory(machine_id="MCH-001", category="Schematics & P&IDs", count=12, icon="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"),
        models.DocumentCategory(machine_id="MCH-001", category="Maintenance Manuals", count=8, icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"),
        models.DocumentCategory(machine_id="MCH-001", category="Safety Bulletins", count=4, icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"),
        models.DocumentCategory(machine_id="MCH-001", category="IoT Sensor Logs", count=154, icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z")
    ]

    graph_nodes = [
        models.PartGraphNode(id="m", machine_id="MCH-001", label="Stacker-Reclaimer #04", posX=250, posY=50, bg_color="#0f1419", text_color="#00d4aa"),
        models.PartGraphNode(id="p1", machine_id="MCH-001", label="Main Boom Motor", posX=100, posY=150, bg_color="#1a2332", text_color="#d9e2ec"),
        models.PartGraphNode(id="p2", machine_id="MCH-001", label="Conveyor Drive System", posX=400, posY=150, bg_color="#1a2332", text_color="#d9e2ec"),
        models.PartGraphNode(id="p3", machine_id="MCH-001", label="Slewing Bearing", posX=250, posY=250, bg_color="#1a2332", text_color="#d9e2ec")
    ]

    graph_edges = [
        models.PartGraphEdge(id="e1", machine_id="MCH-001", source="m", target="p1"),
        models.PartGraphEdge(id="e2", machine_id="MCH-001", source="m", target="p2"),
        models.PartGraphEdge(id="e3", machine_id="MCH-001", source="m", target="p3")
    ]

    vault_files = []

    if not manual_exists:
        session.add_all(manuals)
        session.add_all(boms)
        session.add_all(anomalies)
        session.add_all(parts)
        session.add_all(nodes)
        session.add_all(threads)
        session.add_all(messages)
        session.add_all(machines)
        session.add_all(timeline_events)
        session.add_all(doc_categories)
        session.add_all(graph_nodes)
        session.add_all(graph_edges)

    if not vf_exists and vault_files:
        session.add_all(vault_files)

    await session.commit()
    logger.info("Successfully seeded all initial data!")
