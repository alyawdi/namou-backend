# Database 


so I choosed here SQlite becuase it is enough for a project in this size. no need to setup postgress or anything else. DB is only one file. 
I worked with Drizzle as ORM because schema is only plain typescript, migrations would be generated SQL files. 
===============================================================
for the tables they are separated for the following groups 
-Identity group 
users 
sessions 
-Categlog group 
products 
product_images 
product_options 
product_option_values
product_varient 
varient_option_value
-Shopping group 
cart_items
whislist_items 
-Order 
orders
order_items
Migration table 
__drizzle_migrations 
========================================

Decisions I took here 

All columns related to money are stored as integer cents, no floats are used due to rouding bugs risks
-------------------------------------------------------
Sessions are stored in the DB, no JWT is used here. So on logout, session is dead right away. on JWT case it would remain alive until it expires. 
and only the hash of the token is stored, so if the DB is stolen it wouldn't leak sessions for logged in users. emails are unique here at the DB level not only code level to add more protection layer. 
--------------------------------------------------------
cart and orders rows point out to product_variant table (it has the full product options with is it price and stock) 
---------------------------------------------------------
as said above constraints are added on DB level not only code 
like checking on stock or price or quanitity to be greater than 0 
unqiuness for (user_id,variant_id) on the cart so adding the same variant again adds quanitity isnted of adding duplciate rows, also uqniuess in (user_id, product_id) on whishlist. 
-------------------------------------------------------
order_items have a snapshot of the product_variants so it preserve the prices and all the other stuff if they were changed
------------------------------------------------------
Order.references (references column in orders table) are random so user can't guess the other orders or tell how amany orders exists 
------------------------------------------------------
Users Deletion delete sesssion, cart and whishlist on cascade 
products too have their images and options and variants removed too 
Orders only are not cascaded.









Database choice: 
so I choosed here SQlite, easiest option for MVPs or such a project going with a setup for postgres will be overhead for such a thing. and It would be easier for me if I want to deployment 



---------------------------------------------------------------------
For Identitiy group 
users and sessions 
users table have email as a unqiue indexed so it blocks duplicate accounts on database level too (not only in the code) and make up the query when logging in much faster 
emails are lowercased before saving and before lookup so we don't miss up comparing emails or inserting emails 
the password is hashed with a random salt so each user gives different hashes for each user 
only one account is seeded for testing purposes 
=========
for sessions table 
a user can have many sessions 
the table stores the hash of the token sent from the cookie of the user, so if the database was stolen, stored sessions can't be used against the users, 
expired sessoins are cleaned up on each login for the user 
and the ans for the question why sessions in the database and not JWTs is that on logout, session is deleted immediately, A JWT stays alive until it expires 
==========
surely on delete of a user, on cascade their sessions are deleted too 
----------------------------------------------------------------------
Catalog Design 
product and product images are clear tables 
======
product_options stores the options a product can have 
======
product_option_values stores the values for those option 
it has a unique index on both option_id and value column 
======
product_variants 
the customer buys from here, order and cart tables point to this table 
it stores the whole values of the product_id with the sku 
which means the product Tshirt sku TEE-M-BLAC 
with it is prices and the stock remaning for this variant exactly 
=========
and for variant_option_values 
this table stores variant_id and option_value_id a link table between the variant id and the answer 
-------------------------------------------------------------
for shopping tables 
two tables where created up here 

