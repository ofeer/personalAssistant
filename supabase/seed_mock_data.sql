DO $$
DECLARE
  v_user_id UUID;
  v_list1_id UUID;
  v_list2_id UUID;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = 'mintz.ofeer@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User mintz.ofeer@gmail.com not found in auth.users';
  END IF;

  -- List 1: Weekly Groceries
  INSERT INTO shopping_lists (user_id, name)
    VALUES (v_user_id, 'Weekly Groceries')
    RETURNING id INTO v_list1_id;

  INSERT INTO shopping_items (list_id, name, amount, unit, category, sort_order) VALUES
    (v_list1_id, 'Tomatoes',        2,   'kg',     'Fruits & Vegetables', 1000),
    (v_list1_id, 'Bananas',         1,   'pack',   'Fruits & Vegetables', 2000),
    (v_list1_id, 'Avocados',        3,   'pcs',    'Fruits & Vegetables', 3000),
    (v_list1_id, 'Onions',          1,   'kg',     'Fruits & Vegetables', 4000),
    (v_list1_id, 'Milk',            1,   'L',      'Dairy',               5000),
    (v_list1_id, 'Cheese',          200, 'g',      'Dairy',               6000),
    (v_list1_id, 'Yogurt',          4,   'pcs',    'Dairy',               7000),
    (v_list1_id, 'Butter',          1,   'pack',   'Dairy',               8000),
    (v_list1_id, 'Chicken breast',  1,   'kg',     'Meat & Fish',         9000),
    (v_list1_id, 'Salmon',          500, 'g',      'Meat & Fish',         10000),
    (v_list1_id, 'Bread',           1,   'pcs',    'Bakery',              11000),
    (v_list1_id, 'Pita',            1,   'pack',   'Bakery',              12000),
    (v_list1_id, 'Orange juice',    1,   'L',      'Beverages',           13000),
    (v_list1_id, 'Sparkling water', 6,   'bottle', 'Beverages',           14000),
    (v_list1_id, 'Chocolate',       2,   'pcs',    'Snacks & Sweets',     15000),
    (v_list1_id, 'Chips',           1,   'bag',    'Snacks & Sweets',     16000),
    (v_list1_id, 'Dish soap',       1,   'bottle', 'Cleaning',            17000);

  -- Mark a few items as checked to show mixed state
  UPDATE shopping_items
     SET is_checked = true
   WHERE list_id = v_list1_id
     AND name IN ('Bread', 'Orange juice', 'Butter');

  -- List 2: BBQ Party
  INSERT INTO shopping_lists (user_id, name)
    VALUES (v_user_id, 'BBQ Party')
    RETURNING id INTO v_list2_id;

  INSERT INTO shopping_items (list_id, name, amount, unit, category, sort_order) VALUES
    (v_list2_id, 'Burger buns',     12,  'pcs',    'Bakery',              1000),
    (v_list2_id, 'Ground beef',     1.5, 'kg',     'Meat & Fish',         2000),
    (v_list2_id, 'Sausages',        8,   'pcs',    'Meat & Fish',         3000),
    (v_list2_id, 'Corn on the cob', 6,   'pcs',    'Fruits & Vegetables', 4000),
    (v_list2_id, 'Lettuce',         1,   'pcs',    'Fruits & Vegetables', 5000),
    (v_list2_id, 'Tomatoes',        4,   'pcs',    'Fruits & Vegetables', 6000),
    (v_list2_id, 'Cheddar cheese',  300, 'g',      'Dairy',               7000),
    (v_list2_id, 'Beer',            12,  'can',    'Beverages',           8000),
    (v_list2_id, 'Lemonade',        2,   'L',      'Beverages',           9000),
    (v_list2_id, 'Ketchup',         1,   'bottle', 'Pantry',              10000),
    (v_list2_id, 'Mustard',         1,   'bottle', 'Pantry',              11000),
    (v_list2_id, 'Paper plates',    1,   'pack',   NULL,                  12000),
    (v_list2_id, 'Napkins',         1,   'pack',   NULL,                  13000);
END $$;
