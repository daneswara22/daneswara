from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base
from .utils import new_id, to_iso, utcnow


class SerializerMixin:
    """Serialize ORM rows into the same JSON shape the POS frontend already expects."""

    def to_dict(self, exclude: tuple = ()) -> dict:
        out = {}
        for col in self.__table__.columns:  # type: ignore[attr-defined]
            if col.name in exclude:
                continue
            v = getattr(self, col.name)
            if isinstance(v, datetime):
                v = to_iso(v)
            elif isinstance(v, date):
                v = v.isoformat()
            out[col.name] = v
        return out


class Tenant(Base, SerializerMixin):
    __tablename__ = "tenants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(191), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class User(Base, SerializerMixin):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(191), default="")
    role: Mapped[str] = mapped_column(String(20), default="Kasir")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Category(Base, SerializerMixin):
    __tablename__ = "categories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(191))
    color: Mapped[Optional[str]] = mapped_column(String(20), default="#2563EB")
    image: Mapped[Optional[str]] = mapped_column(Text, default="")
    sort_order: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Product(Base, SerializerMixin):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(191))
    sku: Mapped[Optional[str]] = mapped_column(String(100), default="", index=True)
    barcode: Mapped[Optional[str]] = mapped_column(String(100), default="")
    category_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    price: Mapped[float] = mapped_column(Float, default=0)
    cost: Mapped[float] = mapped_column(Float, default=0)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    min_stock: Mapped[int] = mapped_column(Integer, default=5)
    unit: Mapped[Optional[str]] = mapped_column(String(30), default="pcs")
    image: Mapped[Optional[str]] = mapped_column(Text, default="")
    description: Mapped[Optional[str]] = mapped_column(Text, default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class StockMovement(Base, SerializerMixin):
    __tablename__ = "stock_movements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    product_id: Mapped[str] = mapped_column(String(36), index=True)
    product_name: Mapped[str] = mapped_column(String(191), default="")
    type: Mapped[str] = mapped_column(String(20))
    qty: Mapped[int] = mapped_column(Integer, default=0)
    before: Mapped[int] = mapped_column(Integer, default=0)
    after: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[Optional[str]] = mapped_column(Text, default="")
    user_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Sale(Base, SerializerMixin):
    __tablename__ = "sales"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    invoice: Mapped[str] = mapped_column(String(40), index=True)
    items: Mapped[Any] = mapped_column(JSON, default=list)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    tax_rate: Mapped[float] = mapped_column(Float, default=0)
    tax: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    cost: Mapped[float] = mapped_column(Float, default=0)
    profit: Mapped[float] = mapped_column(Float, default=0)
    payment_method: Mapped[str] = mapped_column(String(40), default="Tunai")
    paid_amount: Mapped[float] = mapped_column(Float, default=0)
    change: Mapped[float] = mapped_column(Float, default=0)
    customer_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    customer_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(40), default="")
    channel: Mapped[Optional[str]] = mapped_column(String(40), default="Toko")
    from_order: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    cashier: Mapped[Optional[str]] = mapped_column(String(191), default="")
    cashier_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    refunded: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    refunded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Order(Base, SerializerMixin):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    order_number: Mapped[str] = mapped_column(String(40), index=True)
    customer_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    customer_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    items: Mapped[Any] = mapped_column(JSON, default=list)
    subtotal: Mapped[float] = mapped_column(Float, default=0)
    discount: Mapped[float] = mapped_column(Float, default=0)
    tax_rate: Mapped[float] = mapped_column(Float, default=0)
    tax: Mapped[float] = mapped_column(Float, default=0)
    total: Mapped[float] = mapped_column(Float, default=0)
    deposit_amount: Mapped[float] = mapped_column(Float, default=0)
    deposit_method: Mapped[Optional[str]] = mapped_column(String(40), default="Tunai")
    remaining: Mapped[float] = mapped_column(Float, default=0)
    note: Mapped[Optional[str]] = mapped_column(Text, default="")
    order_type: Mapped[Optional[str]] = mapped_column(String(40), default="Reguler")
    channel: Mapped[Optional[str]] = mapped_column(String(40), default="Toko")
    status: Mapped[str] = mapped_column(String(20), default="Draft", index=True)
    cashier: Mapped[Optional[str]] = mapped_column(String(191), default="")
    invoice: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    settle_paid: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Purchase(Base, SerializerMixin):
    __tablename__ = "purchases"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    po_number: Mapped[str] = mapped_column(String(40), index=True)
    supplier_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    supplier_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    items: Mapped[Any] = mapped_column(JSON, default=list)
    total: Mapped[float] = mapped_column(Float, default=0)
    note: Mapped[Optional[str]] = mapped_column(Text, default="")
    customer_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    order_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    order_number: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="Menunggu", index=True)
    cashier: Mapped[Optional[str]] = mapped_column(String(191), default="")
    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class HeldOrder(Base, SerializerMixin):
    __tablename__ = "held_orders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    label: Mapped[str] = mapped_column(String(191), default="")
    items: Mapped[Any] = mapped_column(JSON, default=list)
    discount: Mapped[float] = mapped_column(Float, default=0)
    cashier: Mapped[Optional[str]] = mapped_column(String(191), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Customer(Base, SerializerMixin):
    __tablename__ = "customers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(191), index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(40), default="")
    email: Mapped[Optional[str]] = mapped_column(String(191), default="")
    address: Mapped[Optional[str]] = mapped_column(Text, default="")
    total_spent: Mapped[float] = mapped_column(Float, default=0)
    visits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Supplier(Base, SerializerMixin):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(191))
    phone: Mapped[Optional[str]] = mapped_column(String(40), default="")
    email: Mapped[Optional[str]] = mapped_column(String(191), default="")
    address: Mapped[Optional[str]] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Expense(Base, SerializerMixin):
    __tablename__ = "expenses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    category: Mapped[str] = mapped_column(String(191))
    amount: Mapped[float] = mapped_column(Float, default=0)
    note: Mapped[Optional[str]] = mapped_column(Text, default="")
    date: Mapped[date] = mapped_column(Date, index=True)
    user_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class OtherIncome(Base, SerializerMixin):
    __tablename__ = "other_income"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    category: Mapped[str] = mapped_column(String(191))
    amount: Mapped[float] = mapped_column(Float, default=0)
    note: Mapped[Optional[str]] = mapped_column(Text, default="")
    date: Mapped[date] = mapped_column(Date, index=True)
    user_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FinanceCategory(Base, SerializerMixin):
    __tablename__ = "finance_categories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    type: Mapped[str] = mapped_column(String(20))  # expense | income
    name: Mapped[str] = mapped_column(String(191))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TenantSettings(Base, SerializerMixin):
    __tablename__ = "settings"
    tenant_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    business_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    address: Mapped[Optional[str]] = mapped_column(Text, default="")
    phone: Mapped[Optional[str]] = mapped_column(String(40), default="")
    currency: Mapped[Optional[str]] = mapped_column(String(10), default="Rp")
    tax_rate: Mapped[Optional[float]] = mapped_column(Float, default=0)
    receipt_footer: Mapped[Optional[str]] = mapped_column(Text, default="")
    logo: Mapped[Optional[str]] = mapped_column(Text, default="")
    print_mode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    paper_width: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    printers: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    active_printer: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class UserSettings(Base, SerializerMixin):
    __tablename__ = "user_settings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    print_mode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    paper_width: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    printers: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    active_printer: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class Activity(Base, SerializerMixin):
    __tablename__ = "activities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    user_name: Mapped[Optional[str]] = mapped_column(String(191), default="")
    action: Mapped[str] = mapped_column(String(191))
    detail: Mapped[Optional[str]] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class GalleryItem(Base, SerializerMixin):
    """Public website gallery (managed from the POS dashboard)."""

    __tablename__ = "gallery_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    tenant_id: Mapped[str] = mapped_column(String(36), index=True)
    src: Mapped[str] = mapped_column(Text)
    label: Mapped[str] = mapped_column(String(191), default="")
    tag: Mapped[Optional[str]] = mapped_column(String(100), default="")
    span: Mapped[Optional[str]] = mapped_column(String(100), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


Index("ix_sales_tenant_created", Sale.tenant_id, Sale.created_at)
Index("ix_orders_tenant_created", Order.tenant_id, Order.created_at)
Index("ix_products_tenant_sort", Product.tenant_id, Product.sort_order)
