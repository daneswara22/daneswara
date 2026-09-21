"""
Backend API test for Custom Tees Orders feature.
Tests the complete order flow: create, list, detail, status update, badge count.
"""
import requests
import sys
import json
from datetime import datetime

BASE_URL = "https://github-web-live-1.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class CustomTeesOrderTester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.created_order_id = None
        
    def log(self, msg, color=Colors.BLUE):
        print(f"{color}{msg}{Colors.END}")
        
    def test(self, name, method, endpoint, expected_status=200, data=None, validate_fn=None):
        """Run a single API test"""
        url = f"{BASE_URL}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        self.tests_run += 1
        self.log(f"\n[{self.tests_run}] Testing: {name}", Colors.BLUE)
        self.log(f"    {method} {endpoint}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
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
                    self.log(f"    Response: {response.text[:300]}", Colors.RED)
                    
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
            
        except Exception as e:
            self.tests_failed += 1
            self.log(f"    ❌ FAILED - Error: {str(e)}", Colors.RED)
            return False, None
            
    def print_summary(self):
        """Print test summary"""
        total = self.tests_run
        passed = self.tests_passed
        failed = self.tests_failed
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print("\n" + "="*80)
        self.log("CUSTOM TEES ORDERS - TEST SUMMARY", Colors.BLUE)
        print("="*80)
        self.log(f"Total Tests: {total}", Colors.BLUE)
        self.log(f"Passed: {passed}", Colors.GREEN)
        self.log(f"Failed: {failed}", Colors.RED)
        self.log(f"Success Rate: {success_rate:.1f}%", Colors.YELLOW)
        print("="*80 + "\n")
        
        return success_rate >= 80

def main():
    tester = CustomTeesOrderTester()
    
    # ============================================================================
    # 1. LOGIN
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 1: AUTHENTICATION", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, result = tester.test(
        "Login with admin credentials",
        "POST", "auth/login", 200,
        data={"username": "admin", "password": "Daneswara321!"},
        validate_fn=lambda r: (
            assert_has_keys(r, ['user', 'token']),
            assert_has_keys(r['user'], ['id', 'username', 'role'])
        )
    )
    
    if not success:
        tester.log("\n❌ CRITICAL: Login failed. Cannot proceed.", Colors.RED)
        tester.print_summary()
        return 1
        
    tester.token = result['token']
    tester.log(f"    Logged in as: {result['user']['username']} (Role: {result['user']['role']})", Colors.GREEN)
    
    # ============================================================================
    # 2. CREATE CUSTOM TEES ORDER
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 2: CREATE ORDER", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    # Sample design with complete data (all 4 views, image layers)
    sample_design = {
        "product": "24 COTTON LOCAL SIZE (BUILDUP TEES)",
        "size": "L",
        "color": {
            "name": "Putih",
            "hex": "#ffffff"
        },
        "views": {
            "Depan": [
                {
                    "id": "img_test123",
                    "type": "image",
                    "src": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                    "name": "test.png",
                    "cx": 50,
                    "cy": 42,
                    "wPct": 42,
                    "rot": 0
                }
            ],
            "Belakang": [],
            "Lengan Kiri": [],
            "Lengan Kanan": []
        }
    }
    
    success, new_order = tester.test(
        "Create Custom Tees order with complete design",
        "POST", "custom-tees-orders", 200,
        data={
            "customer_name": f"Test Customer {datetime.now().strftime('%H%M%S')}",
            "customer_phone": "081234567890",
            "customer_email": "test@example.com",
            "design": sample_design
        },
        validate_fn=lambda r: (
            assert_has_keys(r, ['ok', 'id', 'order_code']),
            assert_field(r, 'ok', True),
            assert_order_code_format(r['order_code'])
        )
    )
    
    if success and new_order:
        tester.created_order_id = new_order['id']
        tester.log(f"    Created order: {new_order['order_code']}", Colors.GREEN)
    
    # Test validation: missing required fields
    tester.test(
        "Create order without customer_name (should fail)",
        "POST", "custom-tees-orders", 400,
        data={
            "customer_phone": "081234567890",
            "design": sample_design
        }
    )
    
    tester.test(
        "Create order without customer_phone (should fail)",
        "POST", "custom-tees-orders", 400,
        data={
            "customer_name": "Test",
            "design": sample_design
        }
    )
    
    tester.test(
        "Create order with invalid email format (should fail)",
        "POST", "custom-tees-orders", 400,
        data={
            "customer_name": "Test",
            "customer_phone": "081234567890",
            "customer_email": "invalid-email",
            "design": sample_design
        }
    )
    
    # ============================================================================
    # 3. LIST ORDERS & BADGE COUNT
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 3: LIST ORDERS & BADGE COUNT", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, orders_list = tester.test(
        "Get Custom Tees orders list (with new_count)",
        "GET", "custom-tees-orders", 200,
        validate_fn=lambda r: (
            assert_has_keys(r, ['orders', 'new_count']),
            assert_is_list(r['orders']),
            assert_new_count_matches(r['orders'], r['new_count'])
        )
    )
    
    if success and orders_list:
        tester.log(f"    Total orders: {len(orders_list['orders'])}", Colors.BLUE)
        tester.log(f"    New orders (Baru): {orders_list['new_count']}", Colors.BLUE)
        
        # Verify our created order is in the list
        if tester.created_order_id:
            found = any(o['id'] == tester.created_order_id for o in orders_list['orders'])
            if found:
                tester.log(f"    ✅ Created order found in list", Colors.GREEN)
            else:
                tester.log(f"    ❌ Created order NOT found in list", Colors.RED)
    
    success, count_result = tester.test(
        "Get badge count (GET /custom-tees-orders/count)",
        "GET", "custom-tees-orders/count", 200,
        validate_fn=lambda r: (
            assert_has_keys(r, ['count']),
            assert_is_number(r['count'])
        )
    )
    
    if success and count_result and orders_list:
        if count_result['count'] == orders_list['new_count']:
            tester.log(f"    ✅ Badge count matches new_count: {count_result['count']}", Colors.GREEN)
        else:
            tester.log(f"    ⚠️  Badge count mismatch: {count_result['count']} vs {orders_list['new_count']}", Colors.YELLOW)
    
    # ============================================================================
    # 4. GET SINGLE ORDER (with full design)
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 4: GET ORDER DETAIL", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not tester.created_order_id:
        tester.log("⚠️  Skipping detail test - no order created", Colors.YELLOW)
    else:
        success, order_detail = tester.test(
            "Get single order with full design",
            "GET", f"custom-tees-orders/{tester.created_order_id}", 200,
            validate_fn=lambda r: (
                assert_has_keys(r, ['id', 'order_code', 'customer_name', 'customer_phone', 
                                   'product_name', 'shirt_size', 'color_name', 'color_hex', 
                                   'status', 'design', 'created_at']),
                assert_has_keys(r['design'], ['product', 'size', 'color', 'views']),
                assert_has_keys(r['design']['views'], ['Depan', 'Belakang', 'Lengan Kiri', 'Lengan Kanan']),
                assert_field(r, 'status', 'Baru')
            )
        )
        
        if success and order_detail:
            tester.log(f"    Order code: {order_detail['order_code']}", Colors.BLUE)
            tester.log(f"    Customer: {order_detail['customer_name']}", Colors.BLUE)
            tester.log(f"    Product: {order_detail['product_name']}", Colors.BLUE)
            tester.log(f"    Size: {order_detail['shirt_size']}", Colors.BLUE)
            tester.log(f"    Color: {order_detail['color_name']} ({order_detail['color_hex']})", Colors.BLUE)
            tester.log(f"    Status: {order_detail['status']}", Colors.BLUE)
            
            # Verify design completeness
            views = order_detail['design']['views']
            total_layers = sum(len(views.get(v, [])) for v in ['Depan', 'Belakang', 'Lengan Kiri', 'Lengan Kanan'])
            tester.log(f"    Design layers: {total_layers} total", Colors.BLUE)
            
            # Check if image src was converted from data URI to storage URL
            depan_layers = views.get('Depan', [])
            if depan_layers and len(depan_layers) > 0:
                first_layer = depan_layers[0]
                if 'src' in first_layer:
                    if first_layer['src'].startswith('http'):
                        tester.log(f"    ✅ Image uploaded to storage (URL: {first_layer['src'][:50]}...)", Colors.GREEN)
                    elif first_layer['src'].startswith('data:'):
                        tester.log(f"    ⚠️  Image still as data URI (not uploaded to storage)", Colors.YELLOW)
    
    # ============================================================================
    # 5. UPDATE ORDER STATUS
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 5: UPDATE ORDER STATUS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not tester.created_order_id:
        tester.log("⚠️  Skipping status update test - no order created", Colors.YELLOW)
    else:
        # Update to Diproses
        success, updated = tester.test(
            "Update order status to 'Diproses'",
            "PATCH", f"custom-tees-orders/{tester.created_order_id}", 200,
            data={"status": "Diproses"},
            validate_fn=lambda r: (
                assert_has_keys(r, ['ok', 'status']),
                assert_field(r, 'status', 'Diproses')
            )
        )
        
        # Verify status persisted
        if success:
            success, verify = tester.test(
                "Verify status persisted",
                "GET", f"custom-tees-orders/{tester.created_order_id}", 200,
                validate_fn=lambda r: assert_field(r, 'status', 'Diproses')
            )
        
        # Update to Selesai
        tester.test(
            "Update order status to 'Selesai'",
            "PATCH", f"custom-tees-orders/{tester.created_order_id}", 200,
            data={"status": "Selesai"},
            validate_fn=lambda r: assert_field(r, 'status', 'Selesai')
        )
        
        # Test invalid status
        tester.test(
            "Update with invalid status (should fail)",
            "PATCH", f"custom-tees-orders/{tester.created_order_id}", 400,
            data={"status": "InvalidStatus"}
        )
    
    # ============================================================================
    # 6. VERIFY BADGE COUNT DECREASED
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 6: VERIFY BADGE COUNT AFTER STATUS CHANGE", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, final_count = tester.test(
        "Get badge count after status change (should decrease)",
        "GET", "custom-tees-orders/count", 200,
        validate_fn=lambda r: assert_has_keys(r, ['count'])
    )
    
    if success and final_count and count_result:
        initial = count_result['count']
        final = final_count['count']
        if final < initial:
            tester.log(f"    ✅ Badge count decreased: {initial} → {final}", Colors.GREEN)
        elif final == initial:
            tester.log(f"    ⚠️  Badge count unchanged: {final} (expected decrease)", Colors.YELLOW)
        else:
            tester.log(f"    ❌ Badge count increased: {initial} → {final}", Colors.RED)
    
    # ============================================================================
    # SUMMARY
    # ============================================================================
    success = tester.print_summary()
    return 0 if success else 1

# Helper validation functions
def assert_field(obj, field, expected_value):
    actual = obj.get(field)
    assert actual == expected_value, f"Field '{field}': expected {expected_value}, got {actual}"

def assert_has_keys(obj, keys):
    for key in keys:
        assert key in obj, f"Missing required key: {key}"

def assert_is_list(obj):
    assert isinstance(obj, list), f"Expected list, got {type(obj)}"

def assert_is_number(obj):
    assert isinstance(obj, (int, float)), f"Expected number, got {type(obj)}"

def assert_order_code_format(code):
    """Validate order code format: CT-YYMMDD-####"""
    import re
    pattern = r'^CT-\d{6}-\d{4}$'
    assert re.match(pattern, code), f"Invalid order code format: {code} (expected CT-YYMMDD-####)"

def assert_new_count_matches(orders, new_count):
    """Verify new_count equals number of 'Baru' status orders"""
    actual_new = sum(1 for o in orders if o.get('status') == 'Baru')
    assert actual_new == new_count, f"new_count mismatch: reported {new_count}, actual {actual_new}"

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
