SELECT 
  u.id AS user_id,
  u.name,
  ud.phone, 
  ud.billing_date,
  
  -- Ambil tanggal tagihan selanjutnya
  CASE
    WHEN CURRENT_DATE <= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(DAY FROM ud.billing_date)::int)
    THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(DAY FROM ud.billing_date)::int)
    ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int + 1, EXTRACT(DAY FROM ud.billing_date)::int)
  END AS next_billing_date,

  -- Hitung berapa hari lagi ke tagihan
  (
    CASE
      WHEN CURRENT_DATE <= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(DAY FROM ud.billing_date)::int)
      THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(DAY FROM ud.billing_date)::int)
      ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int + 1, EXTRACT(DAY FROM ud.billing_date)::int)
    END
    - CURRENT_DATE
  ) AS days_until_next_billing,
  
   -- Hitung berapa hari lewat dari billing sebelumnya jika belum bayar
  (
    CASE
      WHEN CURRENT_DATE > make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(DAY FROM ud.billing_date)::int)
      THEN CURRENT_DATE - make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(DAY FROM ud.billing_date)::int)
      ELSE 0
    END
  ) AS days_overdue,
  COUNT(p.*) FILTER (WHERE p.is_paid = false ) AS unpaid_payments

FROM users u 
JOIN user_details ud ON ud.user_id = u.id
LEFT JOIN payments p ON p.user_id = u.id  AND p.row_status = true 
-- WHERE p.is_paid = false 
-- ud.verify_phone = TRUE
GROUP BY  u.id,u.name, ud.phone, ud.billing_date ORDER BY ud.billing_date