# KARIA V7 test checklist

Test cumulatively. Do not disable a previously working feature to fix a new one.

1. Account/login/password change/admin roles.
2. Admin Users create/disable.
3. Brands create/edit/delete-or-deactivate.
4. Products create, photos/video, publish, edit, delete/archive.
5. Shop catalog, search/filter, product detail, sold-out behavior.
6. Inventory opening/IN/OUT/return/adjustment, delete/reverse, product ledger/value.
7. Materials and material movements.
8. Production order -> material consumption -> finished inventory.
9. Cart persistence and quantities.
10. Checkout address/coupon/shipping.
11. Orders statuses/tracking/refund/cancel.
12. Customers and My Account/order history.
13. Accounting expenses/sales/COGS/fees/tax/refunds/equity.
14. Partners remain 50/50; contributions/distributions do not alter ownership.
15. Reports/dashboard totals and period filters.
16. Coupons CRUD/limits/expiry.
17. Settings/shipping/legal content.
18. RLS, Edge Functions, Storage and audit trail.

Stripe must remain test-mode until webhook signature verification and atomic sale-posting are confirmed.
