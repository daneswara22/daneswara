"""
Test lazy-load pagination on /price-list page.
Creates temporary test products, verifies lazy loading, then cleans up.
"""
import requests
import sys
from datetime import datetime

import os

# Kredensial & base URL diambil dari environment supaya tidak ada rahasia di repo publik.
#   export POS_BASE_URL="https://contoh.tld/api"
#   export POS_USERNAME="admin"
#   export POS_PASSWORD="..."
BASE_URL = os.environ.get("POS_BASE_URL", "http://localhost:3000/api")
POS_USERNAME = os.environ.get("POS_USERNAME", "admin")
POS_PASSWORD = os.environ.get("POS_PASSWORD", "")
def main():
    print("\n" + "="*80)
    print("LAZY LOAD TESTING - /price-list")
    print("="*80)
    
    # Step 1: Login as admin
    print("\n[Step 1] Logging in as admin...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"username": POS_USERNAME, "password": POS_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            print(f"❌ Login failed: {response.status_code}")
            return 1
        
        data = response.json()
        token = data['token']
        print(f"✅ Logged in successfully")
    except Exception as e:
        print(f"❌ Login error: {e}")
        return 1
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Step 2: Check current product count
    print("\n[Step 2] Checking current product count...")
    try:
        response = requests.get(f"{BASE_URL}/public/custom-products?limit=50", timeout=10)
        data = response.json()
        current_count = data['total']
        print(f"✅ Current active products: {current_count}")
    except Exception as e:
        print(f"❌ Error checking products: {e}")
        return 1
    
    # Step 3: Create test products to reach > 9 total
    test_products = []
    needed = max(0, 10 - current_count)
    
    if needed > 0:
        print(f"\n[Step 3] Creating {needed} test products to reach > 9 total...")
        timestamp = datetime.now().strftime('%H%M%S')
        
        for i in range(needed):
            product_data = {
                "title": f"ZZ_TEST_Product_{timestamp}_{i+1}",
                "subtitle": "Test product for lazy load testing",
                "price": 50000 + (i * 1000),
                "supplier": "Test Supplier",
                "size_region": "Test Size",
                "model": "Test Model",
                "material": "Test Material",
                "description": "Temporary test product - will be deleted",
                "is_active": True,
                "sort_order": 9999 + i
            }
            
            try:
                response = requests.post(
                    f"{BASE_URL}/custom-products",
                    json=product_data,
                    headers=headers,
                    timeout=10
                )
                if response.status_code == 200:
                    product = response.json()
                    test_products.append(product['id'])
                    print(f"   ✅ Created: {product_data['title']} (ID: {product['id']})")
                else:
                    print(f"   ❌ Failed to create product {i+1}: {response.status_code}")
            except Exception as e:
                print(f"   ❌ Error creating product {i+1}: {e}")
    else:
        print(f"\n[Step 3] Already have {current_count} products (> 9), no need to create more")
    
    # Step 4: Verify total count
    print("\n[Step 4] Verifying total product count...")
    try:
        response = requests.get(f"{BASE_URL}/public/custom-products?limit=50", timeout=10)
        data = response.json()
        final_count = data['total']
        print(f"✅ Total active products now: {final_count}")
        
        if final_count > 9:
            print(f"✅ Condition met: {final_count} > 9 products")
        else:
            print(f"❌ Still not enough products: {final_count} <= 9")
    except Exception as e:
        print(f"❌ Error verifying count: {e}")
    
    # Step 5: Test pagination via API
    print("\n[Step 5] Testing pagination via API...")
    try:
        # Get page 1 with limit 9
        response1 = requests.get(f"{BASE_URL}/public/custom-products?page=1&limit=9", timeout=10)
        page1 = response1.json()
        
        print(f"   Page 1: {len(page1['items'])} items")
        print(f"   has_more: {page1['has_more']}")
        
        if page1['has_more']:
            print("   ✅ has_more=true indicates more products available")
            
            # Get page 2
            response2 = requests.get(f"{BASE_URL}/public/custom-products?page=2&limit=9", timeout=10)
            page2 = response2.json()
            
            print(f"   Page 2: {len(page2['items'])} items")
            
            # Check for duplicates
            page1_ids = {item['id'] for item in page1['items']}
            page2_ids = {item['id'] for item in page2['items']}
            overlap = page1_ids & page2_ids
            
            if not overlap:
                print("   ✅ No duplicate products between pages")
            else:
                print(f"   ❌ Found {len(overlap)} duplicate products")
        else:
            print("   ⚠️  has_more=false (might be exactly 9 products)")
    except Exception as e:
        print(f"   ❌ Error testing pagination: {e}")
    
    # Step 6: Cleanup - delete test products
    if test_products:
        print(f"\n[Step 6] Cleaning up {len(test_products)} test products...")
        for product_id in test_products:
            try:
                response = requests.delete(
                    f"{BASE_URL}/custom-products/{product_id}",
                    headers=headers,
                    timeout=10
                )
                if response.status_code == 200:
                    print(f"   ✅ Deleted product: {product_id}")
                else:
                    print(f"   ❌ Failed to delete {product_id}: {response.status_code}")
            except Exception as e:
                print(f"   ❌ Error deleting {product_id}: {e}")
        
        # Verify cleanup
        print("\n[Step 7] Verifying cleanup...")
        try:
            response = requests.get(f"{BASE_URL}/public/custom-products?limit=50", timeout=10)
            data = response.json()
            final_count = data['total']
            print(f"✅ Final product count: {final_count}")
            
            if final_count == current_count:
                print(f"✅ Successfully restored to original count ({current_count})")
            else:
                print(f"⚠️  Count changed: was {current_count}, now {final_count}")
        except Exception as e:
            print(f"❌ Error verifying cleanup: {e}")
    else:
        print("\n[Step 6] No test products to clean up")
    
    print("\n" + "="*80)
    print("LAZY LOAD TESTING COMPLETED")
    print("="*80)
    
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
