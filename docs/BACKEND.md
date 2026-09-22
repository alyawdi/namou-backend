# Backend 
For the backend I used Express 5 using typescript 
---------------------------------------------------
I went for folders by feature instead of layers, I don't use this usually.
I usually goes with the split 'controller -> services -> repositories' split. but for the size of project, I don't want to spread the feature across three folders and end up opening each one to change the feature. 

sessions in a cookie and not in JWT 
-A JWT can't be revoked. Logout, a stolen token, a banned user- all stay valid until expiry which I don't want. logout delete the row and the session is dead on the next request. 
-LocalStorage is readable by any script on the page, so an XSS attack risk is raised here. an http only cookie isn't reachable from js. 

I used scrypt in node js for password hashing, it is a native library that comes with node, so I avoid the overhead of dependency.


Checkout is one transaction, when a user place an order, it is a four writes
take the stock 
write the order 
snapshot the lines 
empty the cart 
all of those run in one transaction it either all or none with a roll back

I used better-sqlite3 it is the best fit for our case here 

product have a shared query across all the project to avoid drifting 
