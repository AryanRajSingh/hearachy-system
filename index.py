num=[5,2,9,1,7]

for i in range(len(num)):
   for j in range(i+1, len(num)):
     if num[i] > num[j]:
       num[i], num[j] = num[j], num[i]
       
       print("Ascending order:", num)
       