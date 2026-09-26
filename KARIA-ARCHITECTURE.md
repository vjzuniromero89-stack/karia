# KARIA Architecture
Public: Home cinematic → Shop → Brand/Collection → Product → Cart → Checkout → Account/Orders.
Admin: Dashboard → Orders → Products → Brands → Inventory → Production → Customers → Accounting → Reports → Admin Users → Settings.

Roles: customer, staff, admin, super_admin.
Ownership: two partners at 50% each; unequal cash contributions do not alter ownership automatically.
Accounting: sales, shipping, tax liability, Stripe clearing/fees, inventory/COGS, expenses, payouts, partner equity/distributions.
Inventory: immutable movement history; confirmed sales create OUT, returns create RETURN, production completion creates PRODUCTION_IN.
