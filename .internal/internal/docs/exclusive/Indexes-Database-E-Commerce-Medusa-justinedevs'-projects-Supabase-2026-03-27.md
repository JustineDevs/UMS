# Indexes | Database | E-Commerce-Medusa | justinedevs' projects | Supabase

**Source:** https://supabase.com/dashboard/project/oqpapabwusuvfjkoqrzg/database/indexes
**Saved:** 2026-03-27T15:50:48.230Z

*Generated with [markdown-printer](https://github.com/levz0r/markdown-printer) (v1.1.1) by [Lev Gelfenbuim](https://lev.engineer)*

---

Table

Columns

Name

account\_holder

id

account\_holder\_pkey

api\_key

id

api\_key\_pkey

application\_method\_buy\_rules

application\_method\_id, promotion\_rule\_id

application\_method\_buy\_rules\_pkey

application\_method\_target\_rules

application\_method\_id, promotion\_rule\_id

application\_method\_target\_rules\_pkey

auth\_identity

id

auth\_identity\_pkey

capture

id

capture\_pkey

cart\_address

id

cart\_address\_pkey

cart\_line\_item\_adjustment

id

cart\_line\_item\_adjustment\_pkey

cart\_line\_item

id

cart\_line\_item\_pkey

cart\_line\_item\_tax\_line

id

cart\_line\_item\_tax\_line\_pkey

cart\_payment\_collection

cart\_id, payment\_collection\_id

cart\_payment\_collection\_pkey

cart

id

cart\_pkey

cart\_promotion

cart\_id, promotion\_id

cart\_promotion\_pkey

cart\_shipping\_method\_adjustment

id

cart\_shipping\_method\_adjustment\_pkey

cart\_shipping\_method

id

cart\_shipping\_method\_pkey

cart\_shipping\_method\_tax\_line

id

cart\_shipping\_method\_tax\_line\_pkey

credit\_line

id

credit\_line\_pkey

currency

code

currency\_pkey

customer\_account\_holder

customer\_id, account\_holder\_id

customer\_account\_holder\_pkey

customer\_address

id

customer\_address\_pkey

customer\_group\_customer

id

customer\_group\_customer\_pkey

customer\_group

id

customer\_group\_pkey

customer

id

customer\_pkey

fulfillment\_address

id

fulfillment\_address\_pkey

fulfillment\_item

id

fulfillment\_item\_pkey

fulfillment\_label

id

fulfillment\_label\_pkey

fulfillment

id

fulfillment\_pkey

fulfillment\_provider

id

fulfillment\_provider\_pkey

fulfillment\_set

id

fulfillment\_set\_pkey

geo\_zone

id

geo\_zone\_pkey

account\_holder

deleted\_at

IDX\_account\_holder\_deleted\_at

customer\_account\_holder

account\_holder\_id

IDX\_account\_holder\_id\_5cb3a0c0

account\_holder

provider\_id, external\_id

IDX\_account\_holder\_provider\_id\_external\_id\_unique

api\_key

deleted\_at

IDX\_api\_key\_deleted\_at

api\_key

redacted

IDX\_api\_key\_redacted

api\_key

revoked\_at

IDX\_api\_key\_revoked\_at

api\_key

token

IDX\_api\_key\_token\_unique

api\_key

type

IDX\_api\_key\_type

promotion\_application\_method

allocation

IDX\_application\_method\_allocation

promotion\_application\_method

target\_type

IDX\_application\_method\_target\_type

promotion\_application\_method

type

IDX\_application\_method\_type

auth\_identity

deleted\_at

IDX\_auth\_identity\_deleted\_at

promotion\_campaign\_budget

type

IDX\_campaign\_budget\_type

capture

deleted\_at

IDX\_capture\_deleted\_at

capture

payment\_id

IDX\_capture\_payment\_id

cart\_address

deleted\_at

IDX\_cart\_address\_deleted\_at

cart

billing\_address\_id

IDX\_cart\_billing\_address\_id

credit\_line

reference, reference\_id

IDX\_cart\_credit\_line\_reference\_reference\_id

cart

currency\_code

IDX\_cart\_currency\_code

cart

customer\_id

IDX\_cart\_customer\_id

cart

deleted\_at

IDX\_cart\_deleted\_at

cart\_payment\_collection

cart\_id

IDX\_cart\_id\_-4a39f6c9

order\_cart

cart\_id

IDX\_cart\_id\_-71069c16

cart\_promotion

cart\_id

IDX\_cart\_id\_-a9d4a70b

cart\_line\_item\_adjustment

deleted\_at

IDX\_cart\_line\_item\_adjustment\_deleted\_at

cart\_line\_item\_adjustment

item\_id

IDX\_cart\_line\_item\_adjustment\_item\_id

cart\_line\_item

cart\_id

IDX\_cart\_line\_item\_cart\_id

cart\_line\_item

deleted\_at

IDX\_cart\_line\_item\_deleted\_at

cart\_line\_item\_tax\_line

deleted\_at

IDX\_cart\_line\_item\_tax\_line\_deleted\_at

cart\_line\_item\_tax\_line

item\_id

IDX\_cart\_line\_item\_tax\_line\_item\_id

cart

region\_id

IDX\_cart\_region\_id

cart

sales\_channel\_id

IDX\_cart\_sales\_channel\_id

cart

shipping\_address\_id

IDX\_cart\_shipping\_address\_id

cart\_shipping\_method\_adjustment

deleted\_at

IDX\_cart\_shipping\_method\_adjustment\_deleted\_at

cart\_shipping\_method\_adjustment

shipping\_method\_id

IDX\_cart\_shipping\_method\_adjustment\_shipping\_method\_id

cart\_shipping\_method

cart\_id

IDX\_cart\_shipping\_method\_cart\_id

cart\_shipping\_method

deleted\_at

IDX\_cart\_shipping\_method\_deleted\_at

cart\_shipping\_method\_tax\_line

deleted\_at

IDX\_cart\_shipping\_method\_tax\_line\_deleted\_at

cart\_shipping\_method\_tax\_line

shipping\_method\_id

IDX\_cart\_shipping\_method\_tax\_line\_shipping\_method\_id

product\_category

handle

IDX\_category\_handle\_unique

product\_collection

handle

IDX\_collection\_handle\_unique

credit\_line

cart\_id

IDX\_credit\_line\_cart\_id

credit\_line

deleted\_at

IDX\_credit\_line\_deleted\_at

customer\_address

customer\_id

IDX\_customer\_address\_customer\_id

customer\_address

deleted\_at

IDX\_customer\_address\_deleted\_at

customer\_address

customer\_id

IDX\_customer\_address\_unique\_customer\_billing

customer\_address

customer\_id

IDX\_customer\_address\_unique\_customer\_shipping

customer

deleted\_at

IDX\_customer\_deleted\_at

customer

email, has\_account

IDX\_customer\_email\_has\_account\_unique

customer\_group\_customer

customer\_group\_id

IDX\_customer\_group\_customer\_customer\_group\_id

customer\_group\_customer

customer\_id

IDX\_customer\_group\_customer\_customer\_id

customer\_group\_customer

deleted\_at

IDX\_customer\_group\_customer\_deleted\_at

customer\_group

deleted\_at

IDX\_customer\_group\_deleted\_at

customer\_group

name

IDX\_customer\_group\_name\_unique

customer\_account\_holder

customer\_id

IDX\_customer\_id\_5cb3a0c0

publishable\_api\_key\_sales\_channel

deleted\_at

IDX\_deleted\_at\_-1d67bae40

location\_fulfillment\_provider

deleted\_at

IDX\_deleted\_at\_-1e5992737

return\_fulfillment

deleted\_at

IDX\_deleted\_at\_-31ea43a

cart\_payment\_collection

deleted\_at

IDX\_deleted\_at\_-4a39f6c9

order\_cart

deleted\_at

IDX\_deleted\_at\_-71069c16

order\_promotion

deleted\_at

IDX\_deleted\_at\_-71518339

cart\_promotion

deleted\_at

IDX\_deleted\_at\_-a9d4a70b

location\_fulfillment\_set

deleted\_at

IDX\_deleted\_at\_-e88adb96

order\_fulfillment

deleted\_at

IDX\_deleted\_at\_-e8d2543e

product\_shipping\_profile

deleted\_at

IDX\_deleted\_at\_17a262437

product\_variant\_inventory\_item

deleted\_at

IDX\_deleted\_at\_17b4c4e35

region\_payment\_provider

deleted\_at

IDX\_deleted\_at\_1c934dab0

product\_sales\_channel

deleted\_at

IDX\_deleted\_at\_20b454295

sales\_channel\_stock\_location

deleted\_at

IDX\_deleted\_at\_26d06f470

product\_variant\_price\_set

deleted\_at

IDX\_deleted\_at\_52b23597

customer\_account\_holder

deleted\_at

IDX\_deleted\_at\_5cb3a0c0

user\_rbac\_role

deleted\_at

IDX\_deleted\_at\_64ff0c4c

shipping\_option\_price\_set

deleted\_at

IDX\_deleted\_at\_ba32fa9c

order\_payment\_collection

deleted\_at

IDX\_deleted\_at\_f42b9949

fulfillment\_address

deleted\_at

IDX\_fulfillment\_address\_deleted\_at

fulfillment

deleted\_at

IDX\_fulfillment\_deleted\_at

return\_fulfillment

fulfillment\_id

IDX\_fulfillment\_id\_-31ea43a

order\_fulfillment

fulfillment\_id

IDX\_fulfillment\_id\_-e8d2543e

fulfillment\_item

deleted\_at

IDX\_fulfillment\_item\_deleted\_at

fulfillment\_item

fulfillment\_id

IDX\_fulfillment\_item\_fulfillment\_id

fulfillment\_item

inventory\_item\_id

IDX\_fulfillment\_item\_inventory\_item\_id

fulfillment\_item

line\_item\_id

IDX\_fulfillment\_item\_line\_item\_id

fulfillment\_label

deleted\_at

IDX\_fulfillment\_label\_deleted\_at

fulfillment\_label

fulfillment\_id

IDX\_fulfillment\_label\_fulfillment\_id

fulfillment

location\_id

IDX\_fulfillment\_location\_id

fulfillment\_provider

deleted\_at

IDX\_fulfillment\_provider\_deleted\_at

location\_fulfillment\_provider

fulfillment\_provider\_id

IDX\_fulfillment\_provider\_id\_-1e5992737

fulfillment\_set

deleted\_at

IDX\_fulfillment\_set\_deleted\_at

location\_fulfillment\_set

fulfillment\_set\_id

IDX\_fulfillment\_set\_id\_-e88adb96

fulfillment\_set

name

IDX\_fulfillment\_set\_name\_unique

fulfillment

shipping\_option\_id

IDX\_fulfillment\_shipping\_option\_id

geo\_zone

city

IDX\_geo\_zone\_city

geo\_zone

country\_code

IDX\_geo\_zone\_country\_code

geo\_zone

deleted\_at

IDX\_geo\_zone\_deleted\_at

geo\_zone

province\_code

IDX\_geo\_zone\_province\_code

geo\_zone

service\_zone\_id

IDX\_geo\_zone\_service\_zone\_id

publishable\_api\_key\_sales\_channel

id

IDX\_id\_-1d67bae40

location\_fulfillment\_provider

id

IDX\_id\_-1e5992737

return\_fulfillment

id

IDX\_id\_-31ea43a

cart\_payment\_collection

id

IDX\_id\_-4a39f6c9

order\_cart

id

IDX\_id\_-71069c16

order\_promotion

id

IDX\_id\_-71518339

cart\_promotion

id

IDX\_id\_-a9d4a70b

location\_fulfillment\_set

id

IDX\_id\_-e88adb96

order\_fulfillment

id

IDX\_id\_-e8d2543e

product\_shipping\_profile

id

IDX\_id\_17a262437

product\_variant\_inventory\_item

id

IDX\_id\_17b4c4e35

region\_payment\_provider

id

IDX\_id\_1c934dab0

product\_sales\_channel

id

IDX\_id\_20b454295

sales\_channel\_stock\_location

id

IDX\_id\_26d06f470

product\_variant\_price\_set

id

IDX\_id\_52b23597

customer\_account\_holder

id

IDX\_id\_5cb3a0c0

user\_rbac\_role

id

IDX\_id\_64ff0c4c

shipping\_option\_price\_set

id

IDX\_id\_ba32fa9c

order\_payment\_collection

id

IDX\_id\_f42b9949

image

deleted\_at

IDX\_image\_deleted\_at

image

product\_id

IDX\_image\_product\_id

inventory\_item

deleted\_at

IDX\_inventory\_item\_deleted\_at

product\_variant\_inventory\_item

inventory\_item\_id

IDX\_inventory\_item\_id\_17b4c4e35

inventory\_item

sku

IDX\_inventory\_item\_sku

inventory\_level

deleted\_at

IDX\_inventory\_level\_deleted\_at

inventory\_level

inventory\_item\_id

IDX\_inventory\_level\_inventory\_item\_id

inventory\_level

location\_id

IDX\_inventory\_level\_location\_id

inventory\_level

inventory\_item\_id, location\_id

IDX\_inventory\_level\_location\_id\_inventory\_item\_id

invite

deleted\_at

IDX\_invite\_deleted\_at

invite

email

IDX\_invite\_email\_unique

invite

token

IDX\_invite\_token

cart\_line\_item\_adjustment

promotion\_id

IDX\_line\_item\_adjustment\_promotion\_id

cart\_line\_item

product\_id

IDX\_line\_item\_product\_id

order\_line\_item

product\_type\_id

IDX\_line\_item\_product\_type\_id

cart\_line\_item\_tax\_line

tax\_rate\_id

IDX\_line\_item\_tax\_line\_tax\_rate\_id

cart\_line\_item

variant\_id

IDX\_line\_item\_variant\_id

notification

deleted\_at

IDX\_notification\_deleted\_at

notification

idempotency\_key

IDX\_notification\_idempotency\_key\_unique

notification\_provider

deleted\_at

IDX\_notification\_provider\_deleted\_at

notification

provider\_id

IDX\_notification\_provider\_id

notification

receiver\_id

IDX\_notification\_receiver\_id

product\_option

product\_id, title

IDX\_option\_product\_id\_title\_unique

product\_option\_value

option\_id, value

IDX\_option\_value\_option\_id\_unique

order\_address

customer\_id

IDX\_order\_address\_customer\_id

order\_address

deleted\_at

IDX\_order\_address\_deleted\_at

order

billing\_address\_id

IDX\_order\_billing\_address\_id

order\_change\_action

claim\_id

IDX\_order\_change\_action\_claim\_id

order\_change\_action

deleted\_at

IDX\_order\_change\_action\_deleted\_at

order\_change\_action

exchange\_id

IDX\_order\_change\_action\_exchange\_id

order\_change\_action

order\_change\_id

IDX\_order\_change\_action\_order\_change\_id

order\_change\_action

order\_id

IDX\_order\_change\_action\_order\_id

order\_change\_action

ordering

IDX\_order\_change\_action\_ordering

order\_change\_action

return\_id

IDX\_order\_change\_action\_return\_id

order\_change

change\_type

IDX\_order\_change\_change\_type

order\_change

claim\_id

IDX\_order\_change\_claim\_id

order\_change

deleted\_at

IDX\_order\_change\_deleted\_at

order\_change

exchange\_id

IDX\_order\_change\_exchange\_id

order\_change

order\_id

IDX\_order\_change\_order\_id

order\_change

order\_id, version

IDX\_order\_change\_order\_id\_version

order\_change

return\_id

IDX\_order\_change\_return\_id

order\_change

status

IDX\_order\_change\_status

order\_change

order\_id, version

IDX\_order\_change\_version

order\_claim

deleted\_at

IDX\_order\_claim\_deleted\_at

order\_claim

display\_id

IDX\_order\_claim\_display\_id

order\_claim\_item

claim\_id

IDX\_order\_claim\_item\_claim\_id

order\_claim\_item

deleted\_at

IDX\_order\_claim\_item\_deleted\_at

order\_claim\_item\_image

claim\_item\_id

IDX\_order\_claim\_item\_image\_claim\_item\_id

order\_claim\_item\_image

deleted\_at

IDX\_order\_claim\_item\_image\_deleted\_at

order\_claim\_item

item\_id

IDX\_order\_claim\_item\_item\_id

order\_claim

order\_id

IDX\_order\_claim\_order\_id

order\_claim

return\_id

IDX\_order\_claim\_return\_id

order\_credit\_line

deleted\_at

IDX\_order\_credit\_line\_deleted\_at

order\_credit\_line

order\_id

IDX\_order\_credit\_line\_order\_id

order\_credit\_line

order\_id, version

IDX\_order\_credit\_line\_order\_id\_version

order

currency\_code

IDX\_order\_currency\_code

order

custom\_display\_id

IDX\_order\_custom\_display\_id

order

customer\_id

IDX\_order\_customer\_id

order

deleted\_at

IDX\_order\_deleted\_at

order

display\_id

IDX\_order\_display\_id

order\_exchange

deleted\_at

IDX\_order\_exchange\_deleted\_at

order\_exchange

display\_id

IDX\_order\_exchange\_display\_id

order\_exchange\_item

deleted\_at

IDX\_order\_exchange\_item\_deleted\_at

order\_exchange\_item

exchange\_id

IDX\_order\_exchange\_item\_exchange\_id

order\_exchange\_item

item\_id

IDX\_order\_exchange\_item\_item\_id

order\_exchange

order\_id

IDX\_order\_exchange\_order\_id

order\_exchange

return\_id

IDX\_order\_exchange\_return\_id

order\_cart

order\_id

IDX\_order\_id\_-71069c16

order\_promotion

order\_id

IDX\_order\_id\_-71518339

order\_fulfillment

order\_id

IDX\_order\_id\_-e8d2543e

order\_payment\_collection

order\_id

IDX\_order\_id\_f42b9949

order

is\_draft\_order

IDX\_order\_is\_draft\_order

order\_item

deleted\_at

IDX\_order\_item\_deleted\_at

order\_item

item\_id

IDX\_order\_item\_item\_id

order\_item

order\_id

IDX\_order\_item\_order\_id

order\_item

order\_id, version

IDX\_order\_item\_order\_id\_version

order\_line\_item\_adjustment

item\_id

IDX\_order\_line\_item\_adjustment\_item\_id

order\_line\_item

product\_id

IDX\_order\_line\_item\_product\_id

order\_line\_item\_tax\_line

item\_id

IDX\_order\_line\_item\_tax\_line\_item\_id

order\_line\_item

variant\_id

IDX\_order\_line\_item\_variant\_id

order

region\_id

IDX\_order\_region\_id

order

sales\_channel\_id

IDX\_order\_sales\_channel\_id

order

shipping\_address\_id

IDX\_order\_shipping\_address\_id

order\_shipping

claim\_id

IDX\_order\_shipping\_claim\_id

order\_shipping

deleted\_at

IDX\_order\_shipping\_deleted\_at

order\_shipping

exchange\_id

IDX\_order\_shipping\_exchange\_id

order\_shipping

shipping\_method\_id

IDX\_order\_shipping\_item\_id

order\_shipping\_method\_adjustment

shipping\_method\_id

IDX\_order\_shipping\_method\_adjustment\_shipping\_method\_id

order\_shipping\_method

shipping\_option\_id

IDX\_order\_shipping\_method\_shipping\_option\_id

order\_shipping\_method\_tax\_line

shipping\_method\_id

IDX\_order\_shipping\_method\_tax\_line\_shipping\_method\_id

order\_shipping

order\_id

IDX\_order\_shipping\_order\_id

order\_shipping

order\_id, version

IDX\_order\_shipping\_order\_id\_version

order\_shipping

return\_id

IDX\_order\_shipping\_return\_id

order\_shipping

shipping\_method\_id

IDX\_order\_shipping\_shipping\_method\_id

order\_summary

deleted\_at

IDX\_order\_summary\_deleted\_at

order\_summary

order\_id, version

IDX\_order\_summary\_order\_id\_version

order\_transaction

claim\_id

IDX\_order\_transaction\_claim\_id

order\_transaction

currency\_code

IDX\_order\_transaction\_currency\_code

order\_transaction

exchange\_id

IDX\_order\_transaction\_exchange\_id

order\_transaction

order\_id

IDX\_order\_transaction\_order\_id

order\_transaction

order\_id, version

IDX\_order\_transaction\_order\_id\_version

order\_transaction

reference\_id

IDX\_order\_transaction\_reference\_id

order\_transaction

return\_id

IDX\_order\_transaction\_return\_id

payment\_collection

deleted\_at

IDX\_payment\_collection\_deleted\_at

cart\_payment\_collection

payment\_collection\_id

IDX\_payment\_collection\_id\_-4a39f6c9

order\_payment\_collection

payment\_collection\_id

IDX\_payment\_collection\_id\_f42b9949

payment

deleted\_at

IDX\_payment\_deleted\_at

payment

payment\_collection\_id

IDX\_payment\_payment\_collection\_id

payment

payment\_session\_id

IDX\_payment\_payment\_session\_id

payment

payment\_session\_id

IDX\_payment\_payment\_session\_id\_unique

payment\_provider

deleted\_at

IDX\_payment\_provider\_deleted\_at

payment

provider\_id

IDX\_payment\_provider\_id

region\_payment\_provider

payment\_provider\_id

IDX\_payment\_provider\_id\_1c934dab0

payment\_session

deleted\_at

IDX\_payment\_session\_deleted\_at

payment\_session

payment\_collection\_id

IDX\_payment\_session\_payment\_collection\_id

price

currency\_code

IDX\_price\_currency\_code

price

deleted\_at

IDX\_price\_deleted\_at

price\_list

deleted\_at

IDX\_price\_list\_deleted\_at

price\_list

id, status, starts\_at, ends\_at

IDX\_price\_list\_id\_status\_starts\_at\_ends\_at

price\_list\_rule

attribute

IDX\_price\_list\_rule\_attribute

price\_list\_rule

deleted\_at

IDX\_price\_list\_rule\_deleted\_at

price\_list\_rule

price\_list\_id

IDX\_price\_list\_rule\_price\_list\_id

price\_list\_rule

value

IDX\_price\_list\_rule\_value

price\_preference

attribute, value

IDX\_price\_preference\_attribute\_value

price\_preference

deleted\_at

IDX\_price\_preference\_deleted\_at

price

price\_list\_id

IDX\_price\_price\_list\_id

price

price\_set\_id

IDX\_price\_price\_set\_id

price\_rule

attribute

IDX\_price\_rule\_attribute

price\_rule

attribute, value

IDX\_price\_rule\_attribute\_value

price\_rule

attribute, value, price\_id

IDX\_price\_rule\_attribute\_value\_price\_id

price\_rule

deleted\_at

IDX\_price\_rule\_deleted\_at

price\_rule

operator

IDX\_price\_rule\_operator

price\_rule

operator, value

IDX\_price\_rule\_operator\_value

price\_rule

price\_id

IDX\_price\_rule\_price\_id

price\_rule

price\_id, attribute, operator

IDX\_price\_rule\_price\_id\_attribute\_operator\_unique

price\_set

deleted\_at

IDX\_price\_set\_deleted\_at

product\_variant\_price\_set

price\_set\_id

IDX\_price\_set\_id\_52b23597

shipping\_option\_price\_set

price\_set\_id

IDX\_price\_set\_id\_ba32fa9c

product\_category

parent\_category\_id

IDX\_product\_category\_parent\_category\_id

product\_category

mpath

IDX\_product\_category\_path

product\_collection

deleted\_at

IDX\_product\_collection\_deleted\_at

product

collection\_id

IDX\_product\_collection\_id

product

deleted\_at

IDX\_product\_deleted\_at

product

handle

IDX\_product\_handle\_unique

product\_shipping\_profile

product\_id

IDX\_product\_id\_17a262437

product\_sales\_channel

product\_id

IDX\_product\_id\_20b454295

image

rank

IDX\_product\_image\_rank

image

rank, product\_id

IDX\_product\_image\_rank\_product\_id

image

url

IDX\_product\_image\_url

image

url, rank, product\_id

IDX\_product\_image\_url\_rank\_product\_id

product\_option

deleted\_at

IDX\_product\_option\_deleted\_at

product\_option

product\_id

IDX\_product\_option\_product\_id

product\_option\_value

deleted\_at

IDX\_product\_option\_value\_deleted\_at

product\_option\_value

option\_id

IDX\_product\_option\_value\_option\_id

product

status

IDX\_product\_status

product\_tag

deleted\_at

IDX\_product\_tag\_deleted\_at

product\_type

deleted\_at

IDX\_product\_type\_deleted\_at

product

type\_id

IDX\_product\_type\_id

product\_variant

barcode

IDX\_product\_variant\_barcode\_unique

product\_variant

deleted\_at

IDX\_product\_variant\_deleted\_at

product\_variant

ean

IDX\_product\_variant\_ean\_unique

product\_variant

id, product\_id

IDX\_product\_variant\_id\_product\_id

product\_variant

product\_id

IDX\_product\_variant\_product\_id

product\_variant\_product\_image

deleted\_at

IDX\_product\_variant\_product\_image\_deleted\_at

product\_variant\_product\_image

image\_id

IDX\_product\_variant\_product\_image\_image\_id

product\_variant\_product\_image

variant\_id

IDX\_product\_variant\_product\_image\_variant\_id

product\_variant

sku

IDX\_product\_variant\_sku\_unique

product\_variant

upc

IDX\_product\_variant\_upc\_unique

promotion\_application\_method

currency\_code

IDX\_promotion\_application\_method\_currency\_code

promotion\_application\_method

deleted\_at

IDX\_promotion\_application\_method\_deleted\_at

promotion\_application\_method

promotion\_id

IDX\_promotion\_application\_method\_promotion\_id\_unique

promotion\_campaign\_budget

campaign\_id

IDX\_promotion\_campaign\_budget\_campaign\_id\_unique

promotion\_campaign\_budget

deleted\_at

IDX\_promotion\_campaign\_budget\_deleted\_at

promotion\_campaign\_budget\_usage

attribute\_value, budget\_id

IDX\_promotion\_campaign\_budget\_usage\_attribute\_value\_budget\_id\_u

promotion\_campaign\_budget\_usage

budget\_id

IDX\_promotion\_campaign\_budget\_usage\_budget\_id

promotion\_campaign\_budget\_usage

deleted\_at

IDX\_promotion\_campaign\_budget\_usage\_deleted\_at

promotion\_campaign

campaign\_identifier

IDX\_promotion\_campaign\_campaign\_identifier\_unique

promotion\_campaign

deleted\_at

IDX\_promotion\_campaign\_deleted\_at

promotion

campaign\_id

IDX\_promotion\_campaign\_id

promotion

deleted\_at

IDX\_promotion\_deleted\_at

order\_promotion

promotion\_id

IDX\_promotion\_id\_-71518339

cart\_promotion

promotion\_id

IDX\_promotion\_id\_-a9d4a70b

promotion

is\_automatic

IDX\_promotion\_is\_automatic

promotion\_rule

attribute

IDX\_promotion\_rule\_attribute

promotion\_rule

attribute, operator

IDX\_promotion\_rule\_attribute\_operator

promotion\_rule

operator, attribute, id

IDX\_promotion\_rule\_attribute\_operator\_id

promotion\_rule

deleted\_at

IDX\_promotion\_rule\_deleted\_at

promotion\_rule

operator

IDX\_promotion\_rule\_operator

promotion\_rule\_value

deleted\_at

IDX\_promotion\_rule\_value\_deleted\_at

promotion\_rule\_value

promotion\_rule\_id

IDX\_promotion\_rule\_value\_promotion\_rule\_id

promotion\_rule\_value

promotion\_rule\_id, value

IDX\_promotion\_rule\_value\_rule\_id\_value

promotion\_rule\_value

value

IDX\_promotion\_rule\_value\_value

promotion

status

IDX\_promotion\_status

promotion

type

IDX\_promotion\_type

provider\_identity

auth\_identity\_id

IDX\_provider\_identity\_auth\_identity\_id

provider\_identity

deleted\_at

IDX\_provider\_identity\_deleted\_at

provider\_identity

entity\_id, provider

IDX\_provider\_identity\_provider\_entity\_id

publishable\_api\_key\_sales\_channel

publishable\_key\_id

IDX\_publishable\_key\_id\_-1d67bae40

user\_rbac\_role

rbac\_role\_id

IDX\_rbac\_role\_id\_64ff0c4c

refund

deleted\_at

IDX\_refund\_deleted\_at

refund

payment\_id

IDX\_refund\_payment\_id

refund\_reason

deleted\_at

IDX\_refund\_reason\_deleted\_at

refund

refund\_reason\_id

IDX\_refund\_refund\_reason\_id

region\_country

deleted\_at

IDX\_region\_country\_deleted\_at

region\_country

region\_id

IDX\_region\_country\_region\_id

region\_country

region\_id, iso\_2

IDX\_region\_country\_region\_id\_iso\_2\_unique

region

deleted\_at

IDX\_region\_deleted\_at

region\_payment\_provider

region\_id

IDX\_region\_id\_1c934dab0

reservation\_item

deleted\_at

IDX\_reservation\_item\_deleted\_at

reservation\_item

inventory\_item\_id

IDX\_reservation\_item\_inventory\_item\_id

reservation\_item

line\_item\_id

IDX\_reservation\_item\_line\_item\_id

reservation\_item

location\_id

IDX\_reservation\_item\_location\_id

return

claim\_id

IDX\_return\_claim\_id

return

display\_id

IDX\_return\_display\_id

return

exchange\_id

IDX\_return\_exchange\_id

return\_fulfillment

return\_id

IDX\_return\_id\_-31ea43a

return\_item

deleted\_at

IDX\_return\_item\_deleted\_at

return\_item

item\_id

IDX\_return\_item\_item\_id

return\_item

reason\_id

IDX\_return\_item\_reason\_id

return\_item

return\_id

IDX\_return\_item\_return\_id

return

order\_id

IDX\_return\_order\_id

return\_reason

parent\_return\_reason\_id

IDX\_return\_reason\_parent\_return\_reason\_id

return\_reason

value

IDX\_return\_reason\_value

sales\_channel

deleted\_at

IDX\_sales\_channel\_deleted\_at

publishable\_api\_key\_sales\_channel

sales\_channel\_id

IDX\_sales\_channel\_id\_-1d67bae40

product\_sales\_channel

sales\_channel\_id

IDX\_sales\_channel\_id\_20b454295

sales\_channel\_stock\_location

sales\_channel\_id

IDX\_sales\_channel\_id\_26d06f470

script\_migrations

script\_name

idx\_script\_name\_unique

service\_zone

deleted\_at

IDX\_service\_zone\_deleted\_at

service\_zone

fulfillment\_set\_id

IDX\_service\_zone\_fulfillment\_set\_id

service\_zone

name

IDX\_service\_zone\_name\_unique

cart\_shipping\_method\_adjustment

promotion\_id

IDX\_shipping\_method\_adjustment\_promotion\_id

cart\_shipping\_method

shipping\_option\_id

IDX\_shipping\_method\_option\_id

cart\_shipping\_method\_tax\_line

tax\_rate\_id

IDX\_shipping\_method\_tax\_line\_tax\_rate\_id

shipping\_option

deleted\_at

IDX\_shipping\_option\_deleted\_at

shipping\_option\_price\_set

shipping\_option\_id

IDX\_shipping\_option\_id\_ba32fa9c

shipping\_option

provider\_id

IDX\_shipping\_option\_provider\_id

shipping\_option\_rule

deleted\_at

IDX\_shipping\_option\_rule\_deleted\_at

shipping\_option\_rule

shipping\_option\_id

IDX\_shipping\_option\_rule\_shipping\_option\_id

shipping\_option

service\_zone\_id

IDX\_shipping\_option\_service\_zone\_id

shipping\_option

shipping\_option\_type\_id

IDX\_shipping\_option\_shipping\_option\_type\_id

shipping\_option

shipping\_profile\_id

IDX\_shipping\_option\_shipping\_profile\_id

shipping\_option\_type

deleted\_at

IDX\_shipping\_option\_type\_deleted\_at

shipping\_profile

deleted\_at

IDX\_shipping\_profile\_deleted\_at

product\_shipping\_profile

shipping\_profile\_id

IDX\_shipping\_profile\_id\_17a262437

shipping\_profile

name

IDX\_shipping\_profile\_name\_unique

tax\_rate

tax\_region\_id

IDX\_single\_default\_region

stock\_location\_address

deleted\_at

IDX\_stock\_location\_address\_deleted\_at

stock\_location

address\_id

IDX\_stock\_location\_address\_id\_unique

stock\_location

deleted\_at

IDX\_stock\_location\_deleted\_at

location\_fulfillment\_provider

stock\_location\_id

IDX\_stock\_location\_id\_-1e5992737

location\_fulfillment\_set

stock\_location\_id

IDX\_stock\_location\_id\_-e88adb96

sales\_channel\_stock\_location

stock\_location\_id

IDX\_stock\_location\_id\_26d06f470

store\_currency

deleted\_at

IDX\_store\_currency\_deleted\_at

store\_currency

store\_id

IDX\_store\_currency\_store\_id

store

deleted\_at

IDX\_store\_deleted\_at

store\_locale

deleted\_at

IDX\_store\_locale\_deleted\_at

store\_locale

store\_id

IDX\_store\_locale\_store\_id

product\_tag

value

IDX\_tag\_value\_unique

tax\_provider

deleted\_at

IDX\_tax\_provider\_deleted\_at

tax\_rate

deleted\_at

IDX\_tax\_rate\_deleted\_at

tax\_rate\_rule

deleted\_at

IDX\_tax\_rate\_rule\_deleted\_at

tax\_rate\_rule

reference\_id

IDX\_tax\_rate\_rule\_reference\_id

tax\_rate\_rule

tax\_rate\_id

IDX\_tax\_rate\_rule\_tax\_rate\_id

tax\_rate\_rule

tax\_rate\_id, reference\_id

IDX\_tax\_rate\_rule\_unique\_rate\_reference

tax\_rate

tax\_region\_id

IDX\_tax\_rate\_tax\_region\_id

tax\_region

deleted\_at

IDX\_tax\_region\_deleted\_at

tax\_region

parent\_id

IDX\_tax\_region\_parent\_id

tax\_region

provider\_id

IDX\_tax\_region\_provider\_id

tax\_region

country\_code

IDX\_tax\_region\_unique\_country\_nullable\_province

tax\_region

country\_code, province\_code

IDX\_tax\_region\_unique\_country\_province

product\_type

value

IDX\_type\_value\_unique

promotion

code

IDX\_unique\_promotion\_code

user

deleted\_at

IDX\_user\_deleted\_at

user

email

IDX\_user\_email\_unique

user\_rbac\_role

user\_id

IDX\_user\_id\_64ff0c4c

user\_preference

deleted\_at

IDX\_user\_preference\_deleted\_at

user\_preference

user\_id

IDX\_user\_preference\_user\_id

user\_preference

user\_id, key

IDX\_user\_preference\_user\_id\_key\_unique

product\_variant\_inventory\_item

variant\_id

IDX\_variant\_id\_17b4c4e35

product\_variant\_price\_set

variant\_id

IDX\_variant\_id\_52b23597

view\_configuration

deleted\_at

IDX\_view\_configuration\_deleted\_at

view\_configuration

entity, is\_system\_default

IDX\_view\_configuration\_entity\_is\_system\_default

view\_configuration

entity, user\_id

IDX\_view\_configuration\_entity\_user\_id

view\_configuration

user\_id

IDX\_view\_configuration\_user\_id

workflow\_execution

deleted\_at

IDX\_workflow\_execution\_deleted\_at

workflow\_execution

id

IDX\_workflow\_execution\_id

workflow\_execution

retention\_time, updated\_at, state

IDX\_workflow\_execution\_retention\_time\_updated\_at\_state

workflow\_execution

run\_id

IDX\_workflow\_execution\_run\_id

workflow\_execution

state

IDX\_workflow\_execution\_state

workflow\_execution

state, updated\_at

IDX\_workflow\_execution\_state\_updated\_at

workflow\_execution

transaction\_id

IDX\_workflow\_execution\_transaction\_id

workflow\_execution

updated\_at, retention\_time

IDX\_workflow\_execution\_updated\_at\_retention\_time

workflow\_execution

workflow\_id

IDX\_workflow\_execution\_workflow\_id

workflow\_execution

workflow\_id, transaction\_id

IDX\_workflow\_execution\_workflow\_id\_transaction\_id

workflow\_execution

workflow\_id, transaction\_id, run\_id

IDX\_workflow\_execution\_workflow\_id\_transaction\_id\_run\_id\_unique

image

id

image\_pkey

inventory\_item

id

inventory\_item\_pkey

inventory\_level

id

inventory\_level\_pkey

invite

id

invite\_pkey

link\_module\_migrations

id

link\_module\_migrations\_pkey

link\_module\_migrations

table\_name

link\_module\_migrations\_table\_name\_key

location\_fulfillment\_provider

stock\_location\_id, fulfillment\_provider\_id

location\_fulfillment\_provider\_pkey

location\_fulfillment\_set

stock\_location\_id, fulfillment\_set\_id

location\_fulfillment\_set\_pkey

mikro\_orm\_migrations

id

mikro\_orm\_migrations\_pkey

notification

id

notification\_pkey

notification\_provider

id

notification\_provider\_pkey

order\_address

id

order\_address\_pkey

order\_cart

order\_id, cart\_id

order\_cart\_pkey

order\_change\_action

id

order\_change\_action\_pkey

order\_change

id

order\_change\_pkey

order\_claim\_item\_image

id

order\_claim\_item\_image\_pkey

order\_claim\_item

id

order\_claim\_item\_pkey

order\_claim

id

order\_claim\_pkey

order\_credit\_line

id

order\_credit\_line\_pkey

order\_exchange\_item

id

order\_exchange\_item\_pkey

order\_exchange

id

order\_exchange\_pkey

order\_fulfillment

order\_id, fulfillment\_id

order\_fulfillment\_pkey

order\_item

id

order\_item\_pkey

order\_line\_item\_adjustment

id

order\_line\_item\_adjustment\_pkey

order\_line\_item

id

order\_line\_item\_pkey

order\_line\_item\_tax\_line

id

order\_line\_item\_tax\_line\_pkey

order\_payment\_collection

order\_id, payment\_collection\_id

order\_payment\_collection\_pkey

order

id

order\_pkey

order\_promotion

order\_id, promotion\_id

order\_promotion\_pkey

order\_shipping\_method\_adjustment

id

order\_shipping\_method\_adjustment\_pkey

order\_shipping\_method

id

order\_shipping\_method\_pkey

order\_shipping\_method\_tax\_line

id

order\_shipping\_method\_tax\_line\_pkey

order\_shipping

id

order\_shipping\_pkey

order\_summary

id

order\_summary\_pkey

order\_transaction

id

order\_transaction\_pkey

payment\_collection\_payment\_providers

payment\_collection\_id, payment\_provider\_id

payment\_collection\_payment\_providers\_pkey

payment\_collection

id

payment\_collection\_pkey

payment

id

payment\_pkey

payment\_provider

id

payment\_provider\_pkey

payment\_session

id

payment\_session\_pkey

price\_list

id

price\_list\_pkey

price\_list\_rule

id

price\_list\_rule\_pkey

price

id

price\_pkey

price\_preference

id

price\_preference\_pkey

price\_rule

id

price\_rule\_pkey

price\_set

id

price\_set\_pkey

product\_category

id

product\_category\_pkey

product\_category\_product

product\_id, product\_category\_id

product\_category\_product\_pkey

product\_collection

id

product\_collection\_pkey

product\_option

id

product\_option\_pkey

product\_option\_value

id

product\_option\_value\_pkey

product

id

product\_pkey

product\_sales\_channel

product\_id, sales\_channel\_id

product\_sales\_channel\_pkey

product\_shipping\_profile

product\_id, shipping\_profile\_id

product\_shipping\_profile\_pkey

product\_tag

id

product\_tag\_pkey

product\_tags

product\_id, product\_tag\_id

product\_tags\_pkey

product\_type

id

product\_type\_pkey

product\_variant\_inventory\_item

variant\_id, inventory\_item\_id

product\_variant\_inventory\_item\_pkey

product\_variant\_option

variant\_id, option\_value\_id

product\_variant\_option\_pkey

product\_variant

id

product\_variant\_pkey

product\_variant\_price\_set

variant\_id, price\_set\_id

product\_variant\_price\_set\_pkey

product\_variant\_product\_image

id

product\_variant\_product\_image\_pkey

promotion\_application\_method

id

promotion\_application\_method\_pkey

promotion\_campaign\_budget

id

promotion\_campaign\_budget\_pkey

promotion\_campaign\_budget\_usage

id

promotion\_campaign\_budget\_usage\_pkey

promotion\_campaign

id

promotion\_campaign\_pkey

promotion

id

promotion\_pkey

promotion\_promotion\_rule

promotion\_id, promotion\_rule\_id

promotion\_promotion\_rule\_pkey

promotion\_rule

id

promotion\_rule\_pkey

promotion\_rule\_value

id

promotion\_rule\_value\_pkey

provider\_identity

id

provider\_identity\_pkey

publishable\_api\_key\_sales\_channel

publishable\_key\_id, sales\_channel\_id

publishable\_api\_key\_sales\_channel\_pkey

refund

id

refund\_pkey

refund\_reason

id

refund\_reason\_pkey

region\_country

iso\_2

region\_country\_pkey

region\_payment\_provider

region\_id, payment\_provider\_id

region\_payment\_provider\_pkey

region

id

region\_pkey

reservation\_item

id

reservation\_item\_pkey

return\_fulfillment

return\_id, fulfillment\_id

return\_fulfillment\_pkey

return\_item

id

return\_item\_pkey

return

id

return\_pkey

return\_reason

id

return\_reason\_pkey

sales\_channel

id

sales\_channel\_pkey

sales\_channel\_stock\_location

sales\_channel\_id, stock\_location\_id

sales\_channel\_stock\_location\_pkey

script\_migrations

id

script\_migrations\_pkey

service\_zone

id

service\_zone\_pkey

shipping\_option

id

shipping\_option\_pkey

shipping\_option\_price\_set

shipping\_option\_id, price\_set\_id

shipping\_option\_price\_set\_pkey

shipping\_option\_rule

id

shipping\_option\_rule\_pkey

shipping\_option\_type

id

shipping\_option\_type\_pkey

shipping\_profile

id

shipping\_profile\_pkey

stock\_location\_address

id

stock\_location\_address\_pkey

stock\_location

id

stock\_location\_pkey

store\_currency

id

store\_currency\_pkey

store\_locale

id

store\_locale\_pkey

store

id

store\_pkey

tax\_provider

id

tax\_provider\_pkey

tax\_rate

id

tax\_rate\_pkey

tax\_rate\_rule

id

tax\_rate\_rule\_pkey

tax\_region

id

tax\_region\_pkey

user

id

user\_pkey

user\_preference

id

user\_preference\_pkey

user\_rbac\_role

user\_id, rbac\_role\_id

user\_rbac\_role\_pkey

view\_configuration

id

view\_configuration\_pkey

workflow\_execution

workflow\_id, transaction\_id, run\_id

workflow\_execution\_pkey