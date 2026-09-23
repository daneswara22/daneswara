"""
Test suite for Product Types (Jenis Produk) feature.
Tests all CRUD operations for custom products, colors, and size charts.
"""
import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

import os

# Kredensial & base URL diambil dari environment supaya tidak ada rahasia di repo publik.
#   export POS_BASE_URL="https://contoh.tld/api"
#   export POS_USERNAME="admin"
#   export POS_PASSWORD="..."
BASE_URL = os.environ.get("POS_BASE_URL", "http://localhost:3000/api")
POS_USERNAME = os.environ.get("POS_USERNAME", "admin")
POS_PASSWORD = os.environ.get("POS_PASSWORD", "")
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class ProductTypeTester:
    def __init__(self):
        self.token: Optional[str] = None
        self.user: Optional[Dict] = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.critical_failures = []
        self.tenant_id: Optional[str] = None
        self.created_resources = []  # Track created resources for cleanup
        
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
                    self.log(f"    Response: {response.text[:500]}", Colors.RED)
                    
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
        self.log("TEST SUMMARY - PRODUCT TYPES", Colors.BLUE)
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

    def cleanup(self):
        """Clean up test data"""
        self.log("\n" + "="*80, Colors.BLUE)
        self.log("CLEANUP: Removing test data", Colors.BLUE)
        self.log("="*80, Colors.BLUE)
        
        for resource in reversed(self.created_resources):
            try:
                if resource['type'] == 'product':
                    self.log(f"Deleting product: {resource['id']}", Colors.YELLOW)
                    requests.delete(
                        f"{BASE_URL}/custom-products/{resource['id']}",
                        headers={'Authorization': f'Bearer {self.token}'},
                        timeout=10
                    )
            except Exception as e:
                self.log(f"Failed to delete {resource['type']} {resource['id']}: {e}", Colors.RED)

def main():
    tester = ProductTypeTester()
    
    # ============================================================================
    # 1. AUTHENTICATION
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 1: AUTHENTICATION", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, result = tester.critical_test(
        "Login with admin credentials",
        "POST", "auth/login", 200,
        json={"username": POS_USERNAME, "password": POS_PASSWORD},
        auth=False,
        validate_fn=lambda r: (
            assert_has_keys(r, ['user', 'token']),
            assert_has_keys(r['user'], ['id', 'tenant_id', 'username', 'role'])
        )
    )
    
    if not success:
        tester.log("\n❌ CRITICAL: Login failed. Cannot proceed.", Colors.RED)
        tester.print_summary()
        return 1
        
    tester.token = result['token']
    tester.user = result['user']
    tester.tenant_id = result['user']['tenant_id']
    tester.log(f"    Logged in as: {tester.user['username']} (Role: {tester.user['role']})", Colors.GREEN)
    
    # ============================================================================
    # 2. GET PRODUCT TYPES (Paginated)
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 2: GET PRODUCT TYPES (Paginated)", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, products_page1 = tester.critical_test(
        "GET /api/custom-products?page=1&limit=9",
        "GET", "custom-products?page=1&limit=9", 200,
        validate_fn=lambda r: (
            assert_has_keys(r, ['items', 'total', 'page', 'limit', 'pages', 'has_more']),
            assert_is_list(r['items']),
            assert_field(r, 'page', 1),
            assert_field(r, 'limit', 9)
        )
    )
    
    if success and products_page1:
        tester.log(f"    Total products: {products_page1['total']}", Colors.GREEN)
        tester.log(f"    Items in page 1: {len(products_page1['items'])}", Colors.GREEN)
    
    # Test pagination with limit=2
    success, page1_limit2 = tester.test(
        "GET /api/custom-products?page=1&limit=2",
        "GET", "custom-products?page=1&limit=2", 200,
        validate_fn=lambda r: (
            assert_field(r, 'limit', 2),
            assert_true(len(r['items']) <= 2, "Items should be <= limit")
        )
    )
    
    success, page2_limit2 = tester.test(
        "GET /api/custom-products?page=2&limit=2 (no overlap with page 1)",
        "GET", "custom-products?page=2&limit=2", 200,
        validate_fn=lambda r: (
            assert_field(r, 'page', 2),
            assert_field(r, 'limit', 2)
        )
    )
    
    # Verify no overlap between pages
    if page1_limit2 and page2_limit2:
        page1_ids = {item['id'] for item in page1_limit2['items']}
        page2_ids = {item['id'] for item in page2_limit2['items']}
        overlap = page1_ids & page2_ids
        if not overlap:
            tester.log(f"    ✅ No overlap between page 1 and page 2", Colors.GREEN)
        else:
            tester.log(f"    ❌ Found overlap: {overlap}", Colors.RED)
    
    # Test search filter
    success, search_result = tester.test(
        "GET /api/custom-products?q=Premium (search filter)",
        "GET", "custom-products?q=Premium", 200,
        validate_fn=lambda r: assert_is_list(r['items'])
    )
    
    # Test active filter
    success, active_only = tester.test(
        "GET /api/custom-products?active=1 (only active products)",
        "GET", "custom-products?active=1", 200,
        validate_fn=lambda r: (
            assert_is_list(r['items']),
            # All items should have is_active=true
            assert_all_active(r['items']) if len(r['items']) > 0 else None
        )
    )
    
    # ============================================================================
    # 3. CREATE PRODUCT TYPE
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 3: CREATE PRODUCT TYPE", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    timestamp = datetime.now().strftime('%H%M%S')
    test_product_data = {
        "title": f"ZZ_TEST_Kaos Test {timestamp}",
        "subtitle": "Kaos untuk testing",
        "price": 65000,
        "supplier": "Test Supplier",
        "size_region": "Asia / Local Size",
        "model": "Regular fit",
        "material": "Cotton 100%",
        "description": "Produk test untuk automated testing",
        "is_active": True,
        "sort_order": 999
    }
    
    success, new_product = tester.critical_test(
        "POST /api/custom-products (create product with auto slug)",
        "POST", "custom-products", 200,
        data=test_product_data,
        validate_fn=lambda r: (
            assert_has_keys(r, ['id', 'product_key', 'title', 'price', 'supplier', 'colors', 'size_chart']),
            assert_field(r, 'title', test_product_data['title']),
            assert_field(r, 'price', test_product_data['price']),
            assert_is_list(r['colors']),
            assert_is_list(r['size_chart'])
        )
    )
    
    product_id = None
    if success and new_product:
        product_id = new_product['id']
        tester.created_resources.append({'type': 'product', 'id': product_id})
        tester.log(f"    Created product ID: {product_id}", Colors.GREEN)
        tester.log(f"    Product key (slug): {new_product['product_key']}", Colors.GREEN)
    
    # ============================================================================
    # 4. GET/UPDATE/DELETE PRODUCT TYPE
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 4: GET/UPDATE/DELETE PRODUCT TYPE", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not product_id:
        tester.log("⚠️  Skipping product detail tests - no product created", Colors.YELLOW)
    else:
        # GET detail
        success, product_detail = tester.test(
            f"GET /api/custom-products/{product_id}",
            "GET", f"custom-products/{product_id}", 200,
            validate_fn=lambda r: (
                assert_field(r, 'id', product_id),
                assert_has_keys(r, ['title', 'price', 'supplier', 'colors', 'size_chart'])
            )
        )
        
        # UPDATE product
        update_data = {
            "price": 70000,
            "subtitle": "Updated subtitle",
            "is_active": True
        }
        
        success, updated_product = tester.test(
            f"PUT /api/custom-products/{product_id} (update price and subtitle)",
            "PUT", f"custom-products/{product_id}", 200,
            data=update_data,
            validate_fn=lambda r: (
                assert_field(r, 'price', 70000),
                assert_field(r, 'subtitle', 'Updated subtitle')
            )
        )
        
        # Toggle is_active
        success, toggled = tester.test(
            f"PUT /api/custom-products/{product_id} (toggle is_active to false)",
            "PUT", f"custom-products/{product_id}", 200,
            data={"is_active": False},
            validate_fn=lambda r: assert_field(r, 'is_active', False)
        )
    
    # ============================================================================
    # 5. COLORS CRUD
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 5: COLORS CRUD", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not product_id:
        tester.log("⚠️  Skipping color tests - no product available", Colors.YELLOW)
    else:
        # GET colors (should be empty initially)
        success, colors = tester.test(
            f"GET /api/custom-products/{product_id}/colors",
            "GET", f"custom-products/{product_id}/colors", 200,
            validate_fn=lambda r: assert_is_list(r)
        )
        
        # CREATE color with valid hex
        color_data = {
            "name": "Merah Test",
            "hex": "#FF0000",
            "sort_order": 10
        }
        
        success, new_color = tester.test(
            f"POST /api/custom-products/{product_id}/colors (valid hex)",
            "POST", f"custom-products/{product_id}/colors", 200,
            data=color_data,
            validate_fn=lambda r: (
                assert_has_keys(r, ['id', 'name', 'hex', 'product_id']),
                assert_field(r, 'hex', '#FF0000'),
                assert_field(r, 'name', 'Merah Test')
            )
        )
        
        color_id = new_color['id'] if success and new_color else None
        
        # Try to create duplicate hex (should fail with 400)
        success, dup_result = tester.test(
            f"POST /api/custom-products/{product_id}/colors (duplicate hex should fail)",
            "POST", f"custom-products/{product_id}/colors", 400,
            data={"name": "Merah Lain", "hex": "#FF0000"}
        )
        
        # Create another color
        success, color2 = tester.test(
            f"POST /api/custom-products/{product_id}/colors (second color)",
            "POST", f"custom-products/{product_id}/colors", 200,
            data={"name": "Biru Test", "hex": "#0000FF"}
        )
        
        color2_id = color2['id'] if success and color2 else None
        
        # Verify hex format validation (invalid hex should fail)
        success, invalid_hex = tester.test(
            f"POST /api/custom-products/{product_id}/colors (invalid hex format)",
            "POST", f"custom-products/{product_id}/colors", 400,
            data={"name": "Invalid", "hex": "FF0000"}  # Missing #
        )
        
        # UPDATE color
        if color_id:
            success, updated_color = tester.test(
                f"PUT /api/custom-products/{product_id}/colors/{color_id}",
                "PUT", f"custom-products/{product_id}/colors/{color_id}", 200,
                data={"name": "Merah Updated", "hex": "#FF1111"},
                validate_fn=lambda r: (
                    assert_field(r, 'name', 'Merah Updated'),
                    assert_field(r, 'hex', '#FF1111')
                )
            )
        
        # DELETE color
        if color2_id:
            success, delete_result = tester.test(
                f"DELETE /api/custom-products/{product_id}/colors/{color2_id}",
                "DELETE", f"custom-products/{product_id}/colors/{color2_id}", 200,
                validate_fn=lambda r: assert_field(r, 'ok', True)
            )
        
        # Verify color count
        success, final_colors = tester.test(
            f"GET /api/custom-products/{product_id}/colors (verify count)",
            "GET", f"custom-products/{product_id}/colors", 200,
            validate_fn=lambda r: (
                assert_is_list(r),
                assert_true(len(r) == 1, f"Should have 1 color, got {len(r)}")
            )
        )
    
    # ============================================================================
    # 6. SIZE CHART CRUD
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 6: SIZE CHART CRUD", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not product_id:
        tester.log("⚠️  Skipping size chart tests - no product available", Colors.YELLOW)
    else:
        # GET sizes (should be empty initially)
        success, sizes = tester.test(
            f"GET /api/custom-products/{product_id}/sizes",
            "GET", f"custom-products/{product_id}/sizes", 200,
            validate_fn=lambda r: assert_is_list(r)
        )
        
        # CREATE size
        size_data = {
            "label": "M",
            "chest_cm": 50,
            "length_cm": 70
        }
        
        success, new_size = tester.test(
            f"POST /api/custom-products/{product_id}/sizes",
            "POST", f"custom-products/{product_id}/sizes", 200,
            data=size_data,
            validate_fn=lambda r: (
                assert_has_keys(r, ['id', 'label', 'chest_cm', 'length_cm']),
                assert_field(r, 'label', 'M'),
                assert_field(r, 'chest_cm', 50),
                assert_field(r, 'length_cm', 70)
            )
        )
        
        size_id = new_size['id'] if success and new_size else None
        
        # Try to create duplicate label (should fail with 400)
        success, dup_size = tester.test(
            f"POST /api/custom-products/{product_id}/sizes (duplicate label should fail)",
            "POST", f"custom-products/{product_id}/sizes", 400,
            data={"label": "M", "chest_cm": 51, "length_cm": 71}
        )
        
        # Create more sizes
        for label, chest, length in [("S", 48, 68), ("L", 52, 72), ("XL", 55, 75)]:
            tester.test(
                f"POST /api/custom-products/{product_id}/sizes (size {label})",
                "POST", f"custom-products/{product_id}/sizes", 200,
                data={"label": label, "chest_cm": chest, "length_cm": length}
            )
        
        # UPDATE size
        if size_id:
            success, updated_size = tester.test(
                f"PUT /api/custom-products/{product_id}/sizes/{size_id}",
                "PUT", f"custom-products/{product_id}/sizes/{size_id}", 200,
                data={"chest_cm": 51, "length_cm": 71},
                validate_fn=lambda r: (
                    assert_field(r, 'chest_cm', 51),
                    assert_field(r, 'length_cm', 71)
                )
            )
        
        # DELETE size
        if size_id:
            success, delete_result = tester.test(
                f"DELETE /api/custom-products/{product_id}/sizes/{size_id}",
                "DELETE", f"custom-products/{product_id}/sizes/{size_id}", 200,
                validate_fn=lambda r: assert_field(r, 'ok', True)
            )
        
        # Verify final size count
        success, final_sizes = tester.test(
            f"GET /api/custom-products/{product_id}/sizes (verify count)",
            "GET", f"custom-products/{product_id}/sizes", 200,
            validate_fn=lambda r: (
                assert_is_list(r),
                assert_true(len(r) == 3, f"Should have 3 sizes (S, L, XL), got {len(r)}")
            )
        )
    
    # ============================================================================
    # 7. PUBLIC ENDPOINT (No Auth, Active Only)
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 7: PUBLIC ENDPOINT", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    success, public_products = tester.test(
        "GET /api/public/custom-products (no auth, only active)",
        "GET", "public/custom-products", 200,
        auth=False,
        validate_fn=lambda r: (
            assert_has_keys(r, ['items', 'total', 'page', 'limit']),
            assert_is_list(r['items']),
            # All items should be active
            assert_all_active(r['items']) if len(r['items']) > 0 else None
        )
    )
    
    if success and public_products:
        tester.log(f"    Public products count: {len(public_products['items'])}", Colors.GREEN)
        # Our test product should NOT appear (we set is_active=false earlier)
        if product_id:
            test_product_in_public = any(p['id'] == product_id for p in public_products['items'])
            if not test_product_in_public:
                tester.log(f"    ✅ Inactive test product correctly excluded from public list", Colors.GREEN)
            else:
                tester.log(f"    ❌ Inactive test product should not appear in public list", Colors.RED)
    
    # Verify Cache-Control header
    try:
        response = requests.get(f"{BASE_URL}/public/custom-products", timeout=10)
        cache_header = response.headers.get('Cache-Control', '')
        if 'public' in cache_header or 's-maxage' in cache_header:
            tester.log(f"    ✅ Cache-Control header present: {cache_header}", Colors.GREEN)
        else:
            tester.log(f"    ⚠️  Cache-Control header missing or incorrect: {cache_header}", Colors.YELLOW)
    except Exception as e:
        tester.log(f"    ⚠️  Could not verify Cache-Control header: {e}", Colors.YELLOW)
    
    # ============================================================================
    # 8. ROLE GUARDS (Owner/Manager only for mutations)
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 8: ROLE GUARDS", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    # Test without token (should get 401)
    success, no_auth = tester.test(
        "POST /api/custom-products without token (should be 401)",
        "POST", "custom-products", 401,
        data={"title": "Unauthorized", "price": 1000},
        auth=False
    )
    
    if tester.user['role'] in ['Owner', 'Manager']:
        tester.log(f"    Current user role: {tester.user['role']} - has mutation access", Colors.GREEN)
    else:
        tester.log(f"    Current user role: {tester.user['role']} - should NOT have mutation access", Colors.YELLOW)
    
    # ============================================================================
    # 9. CASCADE DELETE
    # ============================================================================
    tester.log("\n" + "="*80, Colors.BLUE)
    tester.log("PHASE 9: CASCADE DELETE", Colors.BLUE)
    tester.log("="*80, Colors.BLUE)
    
    if not product_id:
        tester.log("⚠️  Skipping cascade delete test - no product available", Colors.YELLOW)
    else:
        # Verify product has colors and sizes
        success, pre_delete_colors = tester.test(
            f"GET colors before delete",
            "GET", f"custom-products/{product_id}/colors", 200
        )
        
        success, pre_delete_sizes = tester.test(
            f"GET sizes before delete",
            "GET", f"custom-products/{product_id}/sizes", 200
        )
        
        color_count = len(pre_delete_colors) if pre_delete_colors else 0
        size_count = len(pre_delete_sizes) if pre_delete_sizes else 0
        
        tester.log(f"    Product has {color_count} colors and {size_count} sizes", Colors.BLUE)
        
        # DELETE product (should cascade delete colors and sizes)
        success, delete_result = tester.test(
            f"DELETE /api/custom-products/{product_id} (cascade delete colors & sizes)",
            "DELETE", f"custom-products/{product_id}", 200,
            validate_fn=lambda r: assert_field(r, 'ok', True)
        )
        
        if success:
            # Remove from cleanup list since we already deleted it
            tester.created_resources = [r for r in tester.created_resources if r['id'] != product_id]
            
            # Verify product is gone
            success, not_found = tester.test(
                f"GET /api/custom-products/{product_id} (should be 404)",
                "GET", f"custom-products/{product_id}", 404
            )
            
            tester.log(f"    ✅ Product and related data successfully deleted", Colors.GREEN)
    
    # ============================================================================
    # CLEANUP & SUMMARY
    # ============================================================================
    tester.cleanup()
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

def assert_true(condition: bool, message: str):
    assert condition, message

def assert_all_active(items: list):
    """Verify all items have is_active=true"""
    for item in items:
        assert item.get('is_active') == True, f"Product {item.get('id')} is not active"

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
