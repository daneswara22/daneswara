from typing import List, Literal, Optional

from pydantic import BaseModel

PAYMENT_METHODS = Literal["Tunai", "BCA TOKO", "BRI TOKO", "BCA ADMIN (ELIS)", "QRIS", "E-Wallet"]
ROLES = Literal["Owner", "Manager", "Kasir", "Gudang"]


class LoginInput(BaseModel):
    username: str
    password: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: ROLES


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[ROLES] = None
    password: Optional[str] = None
    active: Optional[bool] = None


class CategoryInput(BaseModel):
    name: str
    color: Optional[str] = "#2563EB"
    image: Optional[str] = ""


class ProductInput(BaseModel):
    name: str
    sku: Optional[str] = ""
    barcode: Optional[str] = ""
    category_id: Optional[str] = None
    price: float = 0
    cost: float = 0
    stock: int = 0
    min_stock: int = 5
    unit: Optional[str] = "pcs"
    image: Optional[str] = ""
    description: Optional[str] = ""
    active: bool = True


class ReorderInput(BaseModel):
    ids: List[str]


class SaleItem(BaseModel):
    product_id: str
    name: str
    price: float
    qty: int
    cost: float = 0
    note: Optional[str] = ""


class SaleInput(BaseModel):
    items: List[SaleItem]
    discount: float = 0
    tax_rate: float = 0
    payment_method: PAYMENT_METHODS
    paid_amount: float = 0
    customer_name: Optional[str] = ""
    customer_id: Optional[str] = None
    order_id: Optional[str] = None
    channel: Optional[str] = "Toko"


class StockInput(BaseModel):
    product_id: str
    type: Literal["Masuk", "Keluar", "Penyesuaian", "Opname"]
    qty: int
    note: Optional[str] = ""


class SettingsInput(BaseModel):
    business_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    receipt_footer: Optional[str] = None
    logo: Optional[str] = None
    print_mode: Optional[str] = None
    paper_width: Optional[str] = None
    printers: Optional[list] = None
    active_printer: Optional[str] = None


class CustomerInput(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""


class SupplierInput(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""


class POItem(BaseModel):
    product_id: str
    name: str
    qty: int
    cost: float = 0


class PurchaseOrderInput(BaseModel):
    supplier_id: Optional[str] = None
    supplier_name: Optional[str] = ""
    items: List[POItem]
    note: Optional[str] = ""


class SupplierRef(BaseModel):
    supplier_id: Optional[str] = None


class HeldOrderInput(BaseModel):
    label: str
    items: List[SaleItem]
    discount: float = 0


class CustomOrderInput(BaseModel):
    customer_id: Optional[str] = None
    customer_name: Optional[str] = ""
    items: List[SaleItem]
    discount: float = 0
    tax_rate: float = 0
    deposit_amount: float = 0
    deposit_method: PAYMENT_METHODS = "Tunai"
    order_type: str = "Reguler"
    note: Optional[str] = ""
    channel: Optional[str] = "Toko"


class OrderDepositInput(BaseModel):
    deposit_amount: float
    deposit_method: PAYMENT_METHODS = "Tunai"


class UpdateOrderInput(BaseModel):
    items: List[SaleItem]
    discount: float = 0
    tax_rate: float = 0
    customer_name: Optional[str] = ""
    order_type: str = "Reguler"


class SettleOrderInput(BaseModel):
    payment_method: PAYMENT_METHODS
    paid_amount: float = 0


class FinanceCategoryInput(BaseModel):
    name: str
    type: Literal["expense", "income"]


class FinanceEntryInput(BaseModel):
    category: str
    amount: float
    note: Optional[str] = ""
    date: Optional[str] = None


class GalleryInput(BaseModel):
    src: str
    label: str
    tag: Optional[str] = ""
    span: Optional[str] = ""
    sort_order: Optional[int] = 0
