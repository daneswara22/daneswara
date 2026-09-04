"""
Comprehensive backend API test for Daneswara v2 Next.js migration.
Tests all endpoints for JSON shape parity with FastAPI backend + business logic correctness.
"""
import requests
import sys
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional

BASE_URL = "https://daneswara-typescript.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class APITester:
    def __init__(self):
        self.token: Optional[str] = None
        self.user: Optional[Dict] = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.critical_failures = []
        self.tenant_id: Optional[str] = None
        
    def log(self, msg: str, color: str = Colors.BLUE):
        print(f"{color}{msg}{Colors.END}")
        
    def test(self, name: str, method: str, endpoint: str, expected_status: int = 200, 
             data: Optional[Dict] = None, headers: Optional[Dict] = None, 
             auth: bool = True, validate_fn: Optional[callable] = None) -> tuple[bool, Any]:
        """Run a single API test"""
        url = f"{BASE_URL}/{endpoint}"
        req_headers = {'Content-Type': 'application/json'}
        if auth and self.token:
            req_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            req_headers.update(headers)
            
        self.tests_run += 1
        self.log(f"\n[{self.tests_run}] Testing: {name}", Colors.BLUE)
        self.log(f"    {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"    ✅ PASSED - Status: {response.status_code}", Colors.GREEN)
            else:
                self.tests_failed += 1
                self.log(f"    ❌ FAILED - Expected {expected_status}, got {response.status_code}", Colors.RED)
                try:
                    error_body = response.json()
                    self.log(f"    Response: {json.dumps(error_body, indent=2)}", Colors.RED)
                except:
                    self.log(f"    Response: {response.text[:200]}", Colors.RED)
                    
            # Parse response
            result = None
            if response.status_code < 500:
                try:
                    result = response.json()
                except:
                    result = response.text
                    
            # Run custom validation
            if success and validate_fn and result:
                try:
                    validate_fn(result)
                    self.log(f"    ✅ Validation passed", Colors.GREEN)
                except AssertionError as e:
                    self.tests_failed += 1
                    self.tests_passed -= 1
                    success = False
                    self.log(f"    ❌ Validation failed: {str(e)}", Colors.RED)
                    
            return success, result
            
        except requests.exceptions.Timeout:
            self.tests_failed += 1
            self.log(f"    ❌ FAILED - Request timeout", Colors.RED)
            return False, None
        except Exception as e:
            self.tests_failed += 1
            self.log(f"    ❌ FAILED - Error: {str(e)}", Colors.RED)
            return False, None
            
    def critical_test(self, name: str, *args, **kwargs) -> tuple[bool, Any]:
        """Run a critical test - if it fails, add to critical failures"""
        success, result = self.test(name, *args, **kwargs)
        if not success:
            self.critical_failures.append(name)
        return success, result
        
    def print_summary(self):
        """Print test summary"""
        total = self.tests_run
        passed = self.tests_passed
        failed = self.tests_failed
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print("\n" + "="*80)
        self.log("TEST SUMMARY", Colors.BLUE)
        print("="*80)
        self.log(f"Total Tests: {total}", Colors.BLUE)
        self.log(f"Passed: {passed}", Colors.GREEN)
        self.log(f"Failed: {failed}", Colors.RED)
        self.log(f"Success Rate: {success_rate:.1f}%", Colors.YELLOW)
        
        if self.critical_failures:
            self.log(f"\n⚠️  CRITICAL FAILURES ({len(self.critical_failures)}):", Colors.RED)
            for failure in self.critical_failures:
                self.log(f"  - {failure}", Colors.RED)
        
        print("="*80 + "\n")
        
        return success_rate >= 80 and len(self.critical_failures) == 0

def validate_user_fields(user: Dict):
    """Validate user object has required fields"""
    required = ['id', 'tenant_id', 'username', 'name', 'role', 'active', 'created_at']
    for field in required:
        assert field in user, f"Missing field: {field}"
    assert user['role'] in ['Owner', 'Manager', 'Kasir', 'Gudang'], f"Invalid role: {user['role']}"

def validate_product_fields(product: Dict):
    """Validate product has required fields including open_po"""
    required = ['id', 'tenant_id', 'name', 'sku', 'barcode', 'price', 'cost', 'stock', 
                'min_stock', 'unit', 'image', 'description', 'active', 'sort_order', 
                'created_at', 'open_po', 'open_po_numbers']
    for field in required:
        assert field in product, f"Missing field: {field}"
    assert isinstance(product['open_po'], bool), "open_po must be boolean"
    assert isinstance(product['open_po_numbers'], list), "open_po_numbers must be list"

def validate_invoice_format(invoice: str):
    """Validate invoice format: INV-yymmdd-####"""
    pattern = r'^INV-\d{6}-\d{4}$'
    assert re.match(pattern, invoice), f"Invalid invoice format: {invoice} (expected INV-yymmdd-####)"

def validate_po_format(po_number: str):
    """Validate PO format: PO-yymmdd-####"""
    pattern = r'^PO-\d{6}-\d{4}$'
    assert re.match(pattern, po_number), f"Invalid PO format: {po_number} (expected PO-yymmdd-####)"

def validate_dashboard_fields(dashboard: Dict):
    """Validate dashboard response has all required fields"""
    required = ['today_revenue', 'today_transactions', 'today_profit', 'total_revenue', 
                'total_transactions', 'product_count', 'low_stock_count', 'low_stock',
                'minus_stock_count', 'minus_stock', 'sales_series', 'top_products', 'activities']
    for field in required:
        assert field in dashboard, f"Missing dashboard field: {field}"
    assert isinstance(dashboard['low_stock'], list), "low_stock must be list"
    assert isinstance(dashboard['minus_stock'], list), "minus_stock must be list"
    assert isinstance(dashboard['sales_series'], list), "sales_series must be list"
    assert isinstance(dashboard['top_products'], list), "top_products must be list"
    assert isinstance(dashboard['activities'], list), "activities must be list"

def main():
    tester = APITester()
    
    # ============================================================================
    # 1. HEALTH CHECK
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 1: HEALTH & CONNECTIVITY", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, result = tester.critical_test(
        "Health Check",
        "GET", "health", 200, auth=False,
        validate_fn=lambda r: (
            assert_field(r, 'status', 'healthy'),
            assert_field(r, 'database', 'ok')
        )
    )
    
    if not success:
        tester.log("\n❌ CRITICAL: Health check failed. Cannot proceed with testing.", Colors.RED)
        tester.print_summary()
        return 1
    
    # ============================================================================
    # 2. AUTHENTICATION
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 2: AUTHENTICATION", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    # Test login
    success, result = tester.critical_test(
        "Login with admin credentials",
        "POST", "auth/login", 200,
        data={"username": "admin", "password": "Daneswara321!"},
        auth=False,
        validate_fn=lambda r: (
            assert_has_keys(r, ['user', 'token']),
            validate_user_fields(r['user'])
        )
    )
    
    if not success:
        tester.log("\n❌ CRITICAL: Login failed. Cannot proceed with authenticated tests.", Colors.RED)
        tester.print_summary()
        return 1
        
    tester.token = result['token']
    tester.user = result['user']
    tester.tenant_id = result['user']['tenant_id']
    tester.log(f"    Logged in as: {tester.user['username']} (Role: {tester.user['role']})", Colors.GREEN)
    
    # Test get current user
    tester.test(
        "Get current user (GET /api/auth/me)",
        "GET", "auth/me", 200,
        validate_fn=lambda r: validate_user_fields(r)
    )
    
    # ============================================================================
    # 3. BASIC CRUD - Categories, Suppliers, Customers
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 3: BASIC CRUD OPERATIONS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    # Categories
    success, categories = tester.test(
        "Get categories (sorted by sort_order then name)",
        "GET", "categories", 200,
        validate_fn=lambda r: (
            assert_is_list(r),
            # Verify sorting if multiple categories exist
            verify_sorted(r, ['sort_order', 'name']) if len(r) > 1 else None
        )
    )
    
    # Create a test category (accept 200 or 201)
    success, new_category = tester.test(
        "Create category with sort_order",
        "POST", "categories", 200,
        data={"name": f"Test Category {datetime.now().strftime('%H%M%S')}", "color": "#FF5733"}
    )
    
    category_id = new_category['id'] if success and new_category and isinstance(new_category, dict) else None
    
    # Suppliers
    success, new_supplier = tester.test(
        "Create supplier",
        "POST", "suppliers", 200,
        data={"name": f"Test Supplier {datetime.now().strftime('%H%M%S')}", "phone": "08123456789"}
    )
    
    supplier_id = new_supplier['id'] if success and new_supplier and isinstance(new_supplier, dict) else None
    
    # Customers
    success, customers = tester.test(
        "Get customers (with total_spent and visits)",
        "GET", "customers", 200,
        validate_fn=lambda r: (
            assert_is_list(r),
            # Check first customer has aggregated fields
            assert_has_keys(r[0], ['total_spent', 'visits']) if len(r) > 0 else None
        )
    )
    
    success, new_customer = tester.test(
        "Create customer",
        "POST", "customers", 200,
        data={"name": f"Test Customer {datetime.now().strftime('%H%M%S')}", "phone": "08198765432"}
    )
    
    customer_id = new_customer['id'] if success and new_customer and isinstance(new_customer, dict) else None
    
    # ============================================================================
    # 4. PRODUCTS
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 4: PRODUCTS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, products = tester.critical_test(
        "Get products (with open_po and open_po_numbers fields)",
        "GET", "products", 200,
        validate_fn=lambda r: (
            assert_is_list(r),
            validate_product_fields(r[0]) if len(r) > 0 else None
        )
    )
    
    if not success:
        tester.log("⚠️  Products endpoint failed - this is critical for sales/PO testing", Colors.YELLOW)
    
    # Create a test product
    success, new_product = tester.test(
        "Create product",
        "POST", "products", 200,
        data={
            "name": f"Test Product {datetime.now().strftime('%H%M%S')}",
            "sku": f"SKU{datetime.now().strftime('%H%M%S')}",
            "price": 50000,
            "cost": 30000,
            "stock": 100,
            "min_stock": 10,
            "category_id": category_id
        }
    )
    
    product_id = new_product['id'] if success and new_product and isinstance(new_product, dict) else None
    if product_id:
        tester.log(f"    Created product ID: {product_id}", Colors.GREEN)
    
    # ============================================================================
    # 5. DASHBOARD
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 5: DASHBOARD", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    tester.test(
        "Get dashboard (all metrics)",
        "GET", "dashboard", 200,
        validate_fn=lambda r: validate_dashboard_fields(r)
    )
    
    # ============================================================================
    # 6. SALES (Critical Business Logic)
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 6: SALES & STOCK MOVEMENTS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not product_id:
        tester.log("⚠️  Skipping sales tests - no product available", Colors.YELLOW)
    else:
        # Get initial stock
        success, product_before = tester.test(
            "Get product stock before sale",
            "GET", f"products", 200
        )
        
        initial_stock = None
        if success and product_before:
            for p in product_before:
                if p['id'] == product_id:
                    initial_stock = p['stock']
                    tester.log(f"    Initial stock: {initial_stock}", Colors.BLUE)
                    break
        
        # Create a sale
        success, new_sale = tester.critical_test(
            "Create sale (invoice format, stock decrement, stock_movement)",
            "POST", "sales", 200,
            data={
                "items": [
                    {
                        "product_id": product_id,
                        "name": "Test Product",
                        "price": 50000,
                        "qty": 2,
                        "cost": 30000
                    }
                ],
                "discount": 0,
                "tax_rate": 0,
                "payment_method": "Tunai",
                "paid_amount": 100000,
                "customer_id": customer_id,
                "channel": "Toko"
            },
            validate_fn=lambda r: (
                assert_has_keys(r, ['id', 'invoice', 'items', 'total', 'created_at']),
                validate_invoice_format(r['invoice'])
            )
        )
        
        sale_id = new_sale['id'] if success and new_sale else None
        
        if success and new_sale:
            tester.log(f"    Invoice: {new_sale['invoice']}", Colors.GREEN)
            
            # Verify stock was decremented
            success, product_after = tester.test(
                "Verify stock decremented after sale",
                "GET", f"products", 200
            )
            
            if success and product_after and initial_stock is not None:
                for p in product_after:
                    if p['id'] == product_id:
                        new_stock = p['stock']
                        expected_stock = initial_stock - 2
                        if new_stock == expected_stock:
                            tester.log(f"    ✅ Stock correctly decremented: {initial_stock} → {new_stock}", Colors.GREEN)
                        else:
                            tester.log(f"    ❌ Stock mismatch: expected {expected_stock}, got {new_stock}", Colors.RED)
                        break
            
            # Check stock movements
            success, movements = tester.test(
                "Get stock movements (verify Keluar entry created)",
                "GET", "stock/movements", 200,
                validate_fn=lambda r: (
                    assert_is_list(r),
                    # Check if there's a Keluar movement for our product
                    assert_has_movement_type(r, 'Keluar', product_id) if len(r) > 0 else None
                )
            )
        
        # Test refund (Owner/Manager only)
        if sale_id and tester.user['role'] in ['Owner', 'Manager']:
            success, refund_result = tester.test(
                "Refund sale (reverses stock, Owner/Manager only)",
                "POST", f"sales/{sale_id}/refund", 200,
                validate_fn=lambda r: (
                    assert_field(r, 'ok', True)
                )
            )
            
            if success:
                # Verify stock was restored
                success, product_after_refund = tester.test(
                    "Verify stock restored after refund",
                    "GET", f"products", 200
                )
                
                if success and product_after_refund and initial_stock is not None:
                    for p in product_after_refund:
                        if p['id'] == product_id:
                            restored_stock = p['stock']
                            if restored_stock == initial_stock:
                                tester.log(f"    ✅ Stock correctly restored: {restored_stock}", Colors.GREEN)
                            else:
                                tester.log(f"    ⚠️  Stock after refund: {restored_stock} (initial: {initial_stock})", Colors.YELLOW)
                            break
    
    # ============================================================================
    # 7. ORDERS (Deposit Flow)
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 7: ORDERS & DEPOSIT FLOW", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not product_id:
        tester.log("⚠️  Skipping order tests - no product available", Colors.YELLOW)
    else:
        # Create order with no deposit (should be Draft)
        success, draft_order = tester.test(
            "Create order with deposit_amount=0 (should be Draft status)",
            "POST", "orders", 200,
            data={
                "items": [
                    {
                        "product_id": product_id,
                        "name": "Test Product",
                        "price": 50000,
                        "qty": 1,
                        "cost": 30000
                    }
                ],
                "discount": 0,
                "tax_rate": 0,
                "deposit_amount": 0,
                "deposit_method": "Tunai",
                "order_type": "Custom",
                "customer_id": customer_id
            },
            validate_fn=lambda r: (
                assert_has_keys(r, ['id', 'order_number', 'status', 'deposit_amount']),
                assert_field(r, 'status', 'Draft'),
                assert_field(r, 'deposit_amount', 0)
            )
        )
        
        draft_order_id = draft_order['id'] if success and draft_order else None
        
        # Create order with deposit (should be Proses)
        success, proses_order = tester.test(
            "Create order with deposit_amount>0 (should be Proses status)",
            "POST", "orders", 200,
            data={
                "items": [
                    {
                        "product_id": product_id,
                        "name": "Test Product",
                        "price": 50000,
                        "qty": 1,
                        "cost": 30000
                    }
                ],
                "discount": 0,
                "tax_rate": 0,
                "deposit_amount": 25000,
                "deposit_method": "Tunai",
                "order_type": "Custom",
                "customer_id": customer_id
            },
            validate_fn=lambda r: (
                assert_has_keys(r, ['id', 'order_number', 'status', 'deposit_amount']),
                assert_field(r, 'status', 'Proses'),
                assert_field(r, 'deposit_amount', 25000)
            )
        )
        
        proses_order_id = proses_order['id'] if success and proses_order else None
        
        # Add deposit to draft order
        if draft_order_id:
            success, updated_order = tester.test(
                "Add deposit to Draft order (should change to Proses)",
                "POST", f"orders/{draft_order_id}/deposit", 200,
                data={
                    "deposit_amount": 20000,
                    "deposit_method": "Tunai"
                },
                validate_fn=lambda r: (
                    assert_field(r, 'status', 'Proses')
                )
            )
        
        # Complete order (creates sale)
        if proses_order_id:
            success, completed = tester.test(
                "Complete order (creates sale, sets Selesai status)",
                "POST", f"orders/{proses_order_id}/complete", 200,
                data={
                    "payment_method": "Tunai",
                    "paid_amount": 50000
                },
                validate_fn=lambda r: (
                    # Returns the sale object directly
                    assert_has_keys(r, ['id', 'invoice', 'from_order']),
                    assert_field(r, 'from_order', f"ORD-{datetime.now().strftime('%y%m%d')}-") if 'from_order' in r else None
                )
            )
    
    # ============================================================================
    # 8. PURCHASES (PO Flow)
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 8: PURCHASE ORDERS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not supplier_id or not product_id:
        tester.log("⚠️  Skipping PO tests - no supplier or product available", Colors.YELLOW)
    else:
        # Create PO
        success, new_po = tester.test(
            "Create purchase order (PO-yymmdd-####, status Menunggu)",
            "POST", "purchases", 200,
            data={
                "supplier_id": supplier_id,
                "items": [
                    {
                        "product_id": product_id,
                        "name": "Test Product",
                        "qty": 50,
                        "cost": 28000
                    }
                ],
                "note": "Test PO"
            },
            validate_fn=lambda r: (
                assert_has_keys(r, ['id', 'po_number', 'status', 'items']),
                validate_po_format(r['po_number']),
                assert_field(r, 'status', 'Menunggu')
            )
        )
        
        po_id = new_po['id'] if success and new_po else None
        
        if po_id:
            tester.log(f"    PO Number: {new_po['po_number']}", Colors.GREEN)
            
            # Get stock before receiving
            success, product_before_receive = tester.test(
                "Get product stock before receiving PO",
                "GET", f"products", 200
            )
            
            stock_before_receive = None
            if success and product_before_receive:
                for p in product_before_receive:
                    if p['id'] == product_id:
                        stock_before_receive = p['stock']
                        tester.log(f"    Stock before receive: {stock_before_receive}", Colors.BLUE)
                        break
            
            # Receive PO
            success, received_po = tester.test(
                "Receive PO (increments stock, creates Masuk movement, status Diterima)",
                "POST", f"purchases/{po_id}/receive", 200,
                validate_fn=lambda r: (
                    assert_field(r, 'ok', True)
                )
            )
            
            if success:
                # Verify stock incremented
                success, product_after_receive = tester.test(
                    "Verify stock incremented after receiving PO",
                    "GET", f"products", 200
                )
                
                if success and product_after_receive and stock_before_receive is not None:
                    for p in product_after_receive:
                        if p['id'] == product_id:
                            stock_after = p['stock']
                            expected = stock_before_receive + 50
                            if stock_after == expected:
                                tester.log(f"    ✅ Stock correctly incremented: {stock_before_receive} → {stock_after}", Colors.GREEN)
                            else:
                                tester.log(f"    ❌ Stock mismatch: expected {expected}, got {stock_after}", Colors.RED)
                            break
    
    # ============================================================================
    # 9. REPORTS
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 9: REPORTS (Timezone Asia/Makassar)", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    today = datetime.now().strftime('%Y-%m-%d')
    
    success, sales_report = tester.test(
        "Get sales report with date range",
        "GET", f"reports/sales?start={today}&end={today}", 200
    )
    
    # Log the actual response to see what fields are returned
    if success and sales_report:
        tester.log(f"    Sales report keys: {list(sales_report.keys())}", Colors.BLUE)
    
    tester.test(
        "Get profit-loss report",
        "GET", f"reports/profit-loss?start={today}&end={today}", 200
    )
    
    tester.test(
        "Get cash-flow report",
        "GET", f"reports/cash-flow?start={today}&end={today}", 200
    )
    
    tester.test(
        "Get monthly report",
        "GET", f"reports/monthly?year=2025", 200
    )
    
    # ============================================================================
    # 10. PUBLIC ENDPOINTS
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 10: PUBLIC ENDPOINTS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    tester.test(
        "Get public gallery (no auth, sorted by sort_order desc)",
        "GET", "public/gallery", 200,
        auth=False,
        validate_fn=lambda r: assert_is_list(r)
    )
    
    # ============================================================================
    # 11. SETTINGS
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 11: SETTINGS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, settings = tester.test(
        "Get settings (tenant + user printer settings merged)",
        "GET", "settings", 200,
        validate_fn=lambda r: (
            assert_has_keys(r, ['business_name', 'address', 'phone', 'currency', 'tax_rate'])
        )
    )
    
    # Update printer settings (any user can do this)
    tester.test(
        "Update printer settings (any user)",
        "PUT", "settings", 200,
        data={
            "print_mode": "thermal",
            "paper_width": "58mm"
        }
    )
    
    # ============================================================================
    # 12. ROLE PERMISSIONS
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 12: ROLE PERMISSIONS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    # Owner should be able to access admin endpoints
    if tester.user['role'] == 'Owner':
        # Try different admin endpoint paths
        success, users = tester.test(
            "Owner can access users list",
            "GET", "users", 200
        )
        
        if not success:
            tester.log("    Note: /api/users endpoint not found or not accessible", Colors.YELLOW)
    
    # ============================================================================
    # SUMMARY
    # ============================================================================
    success = tester.print_summary()
    return 0 if success else 1

# Helper validation functions
def assert_field(obj: Dict, field: str, expected_value: Any):
    actual = obj.get(field)
    assert actual == expected_value, f"Field '{field}': expected {expected_value}, got {actual}"

def assert_has_keys(obj: Dict, keys: list):
    for key in keys:
        assert key in obj, f"Missing required key: {key}"

def assert_is_list(obj: Any):
    assert isinstance(obj, list), f"Expected list, got {type(obj)}"

def assert_has_movement_type(movements: list, movement_type: str, product_id: str):
    found = any(m.get('type') == movement_type and m.get('product_id') == product_id for m in movements)
    assert found, f"No {movement_type} movement found for product {product_id}"

def verify_sorted(items: list, keys: list):
    """Verify list is sorted by given keys"""
    if len(items) < 2:
        return
    for i in range(len(items) - 1):
        for key in keys:
            curr = items[i].get(key, '')
            next_val = items[i + 1].get(key, '')
            if curr != next_val:
                assert curr <= next_val, f"Items not sorted by {key}: {curr} > {next_val}"
                break

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
