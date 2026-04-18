from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class Manual(Base):
    __tablename__ = "manuals"
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    machine = Column(String, nullable=False)
    date = Column(String, nullable=False)
    pages = Column(Integer, nullable=False)

class BomItem(Base):
    __tablename__ = "bom_items"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    material = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(String, nullable=False)

class Anomaly(Base):
    __tablename__ = "anomalies"
    id = Column(String, primary_key=True, index=True)
    severity = Column(String, nullable=False)
    description = Column(String, nullable=False)

class ProcurementPart(Base):
    __tablename__ = "procurement_parts"
    id = Column(String, primary_key=True, index=True)
    description = Column(String, nullable=False)
    supplier = Column(String, nullable=False)
    leadTime = Column(String, nullable=False)
    risk = Column(String, nullable=False)
    status = Column(String, nullable=False)
    price = Column(String, nullable=False)

class TelemetryNode(Base):
    __tablename__ = "telemetry_nodes"
    id = Column(String, primary_key=True, index=True)
    status = Column(String, nullable=False)
    load = Column(Integer, nullable=False)
    latency = Column(Integer, nullable=False)
    desc = Column(String, nullable=False)

class FieldThread(Base):
    __tablename__ = "field_threads"
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    name = Column(String, nullable=False)
    time = Column(String, nullable=False)
    status = Column(String, nullable=False)
    unread = Column(Boolean, default=False)
    messages = relationship("FieldMessage", back_populates="thread", cascade="all, delete-orphan")

class FieldMessage(Base):
    __tablename__ = "field_messages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_id = Column(String, ForeignKey("field_threads.id"))
    sender = Column(String, nullable=False)
    name = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    time = Column(String, nullable=False)
    isInsight = Column(Boolean, default=False)
    
    thread = relationship("FieldThread", back_populates="messages")

class Machine(Base):
    __tablename__ = "machines"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    serialNumber = Column(String, nullable=False)
    commissioningDate = Column(String, nullable=False)
    type = Column(String, nullable=False)
    location = Column(String, nullable=False)
    status = Column(String, nullable=False)

class TimelineEvent(Base):
    __tablename__ = "timeline_events"
    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(String, ForeignKey("machines.id"))
    year = Column(String, nullable=False)
    title = Column(String, nullable=False)
    desc = Column(String, nullable=False)
    type = Column(String, nullable=False)

class DocumentCategory(Base):
    __tablename__ = "document_categories"
    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(String, ForeignKey("machines.id"))
    category = Column(String, nullable=False)
    count = Column(Integer, nullable=False)
    icon = Column(String, nullable=False)

class PartGraphNode(Base):
    __tablename__ = "part_graph_nodes"
    id = Column(String, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.id"))
    label = Column(String, nullable=False)
    posX = Column(Integer, nullable=False)
    posY = Column(Integer, nullable=False)
    bg_color = Column(String, nullable=False)
    text_color = Column(String, nullable=False)

class PartGraphEdge(Base):
    __tablename__ = "part_graph_edges"
    id = Column(String, primary_key=True, index=True)
    machine_id = Column(String, ForeignKey("machines.id"))
    source = Column(String, ForeignKey("part_graph_nodes.id"))
    target = Column(String, ForeignKey("part_graph_nodes.id"))

class VaultFile(Base):
    __tablename__ = "vault_files"
    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    content_hash = Column(String, index=True, nullable=True)
    clearance = Column(String, nullable=False, default="L2-Internal")
    size = Column(String, nullable=False)
    upload_date = Column(String, nullable=False)
    status = Column(String, nullable=False)

class PublicFieldNote(Base):
    __tablename__ = "public_field_notes"
    id = Column(String, primary_key=True, index=True)
    content = Column(Text, nullable=True)
    image_path = Column(String, nullable=True)
    sender = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    status = Column(String, nullable=False, default="unclassified")
    classified_machine_id = Column(String, nullable=True)
