function removeDuplicates(a, b) {
  for (var i = 0, len = a.length; i < len; i++) { 
    for (var j = 0, len2 = b.length; j < len2; j++) { 
        if (a[i].name === b[j].name) {
            b.splice(j, 1);
            len2=b.length;
        }
    }
  }
  return b;
}

function findObjectByKey(array, key, value) {
  for (var i = 0; i < array.length; i++) {
      if (array[i][key] === value) {
          return array[i];
      }
  }
  return null;
}

async function verifyErplyUser () {
  const erplyVerifyParams = new URLSearchParams();
  erplyVerifyParams.append('clientCode', process.env.ERPLY_CC);
  erplyVerifyParams.append('username', process.env.ERPLY_UN);
  erplyVerifyParams.append('password', process.env.ERPLY_PWD);
  erplyVerifyParams.append('request', 'verifyUser');
  // erplyVerifyParams.append('sendContentType', 1);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: erplyVerifyParams });
  let data = await response.json();
  return data;
}

async function getPaymentTypes () {
  const getPaymentTypesParams = new URLSearchParams();
  getPaymentTypesParams.append('clientCode', process.env.ERPLY_CC);
  getPaymentTypesParams.append('sessionKey', sessionKey);
  getPaymentTypesParams.append('request', 'getPaymentTypes');
  getPaymentTypesParams.append('id', 6);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: getPaymentTypesParams });
  let data = await response.json();
  return data;
}

async function getErplyProducts () {
  const getProductsParams = new URLSearchParams();
  getProductsParams.append('clientCode', process.env.ERPLY_CC);
  getProductsParams.append('sessionKey', sessionKey);
  getProductsParams.append('request', 'getProducts');
  getProductsParams.append('recordsOnPage', 1000);
  getProductsParams.append('getMatrixVariations', 1);
  getProductsParams.append('getPriceListPrices', 1);
  getProductsParams.append('sendContentType', 1);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: getProductsParams });
  let data = await response.json();
  return data;
}

async function getOnlyChangedErplyProducts (savedUnixTime) {
  const getProductsParams = new URLSearchParams();
  getProductsParams.append('clientCode', process.env.ERPLY_CC);
  getProductsParams.append('sessionKey', sessionKey);
  getProductsParams.append('request', 'getProducts');
  getProductsParams.append('changedSince', savedUnixTime);
  getProductsParams.append('recordsOnPage', 1000);
  getProductsParams.append('getMatrixVariations', 1);
  getProductsParams.append('getPriceListPrices', 1);
  getProductsParams.append('sendContentType', 1);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: getProductsParams });
  let data = await response.json();
  return data;
}

async function getErplyStockData () {
  const getProductStockParams = new URLSearchParams();
  getProductStockParams.append('clientCode', process.env.ERPLY_CC);
  getProductStockParams.append('sessionKey', sessionKey);
  getProductStockParams.append('request', 'getProductStock');
  getProductStockParams.append('displayedInWebshop', 1);
  // getProductStockParams.append('status', 'ACTIVE');
  getProductStockParams.append('sendContentType', 1);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: getProductStockParams });
  let data = await response.json();
  return data;
}

async function getErplyBrands () {
  const getBrandsParams = new URLSearchParams();
  getBrandsParams.append('clientCode', process.env.ERPLY_CC);
  getBrandsParams.append('sessionKey', sessionKey);
  getBrandsParams.append('request', 'getBrands');
  getBrandsParams.append('sendContentType', 1);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: getBrandsParams });
  let data = response.json();
  return data;
}

async function getPriceLists () {
  const getPriceListsParams = new URLSearchParams();
  getPriceListsParams.append('clientCode', process.env.ERPLY_CC);
  getPriceListsParams.append('sessionKey', sessionKey);
  getPriceListsParams.append('request', 'getPriceLists');
  getPriceListsParams.append('status', 'ACTIVE');
  getPriceListsParams.append('getPricesWithVAT', 1);
  getPriceListsParams.append('sendContentType', 1);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: getPriceListsParams });
  let data = response.json();
  return data;
}

async function getProductPricesInPriceLists (productID) {
  const getProductPricesInPriceListsParams = new URLSearchParams();
  getProductPricesInPriceListsParams.append('clientCode', process.env.ERPLY_CC);
  getProductPricesInPriceListsParams.append('sessionKey', sessionKey);
  getProductPricesInPriceListsParams.append('request', 'getProductPrices');
  getProductPricesInPriceListsParams.append('productID', productID);
  //getProductPricesInPriceListsParams.append('active', 1);
  getProductPricesInPriceListsParams.append('sendContentType', 1);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: getProductPricesInPriceListsParams });
  let data = response.json();
  return data;
}

async function saveCustomer (email, first_name, last_name) {
  const saveCustomerParams = new URLSearchParams();
  saveCustomerParams.append('clientCode', process.env.ERPLY_CC);
  saveCustomerParams.append('sessionKey', sessionKey);
  saveCustomerParams.append('request', 'saveCustomer');
  saveCustomerParams.append('email', email);
  saveCustomerParams.append('firstName', first_name);
  saveCustomerParams.append('lastName', last_name);
  saveCustomerParams.append('sendContentType', 1);
  let response = await fetch(ERPLY_URL, { method: 'POST', body: saveCustomerParams });
  let data = await response.json();
  return data;
}

async function getCustomers (email) {
  const getCustomersParams = new URLSearchParams();
  getCustomersParams.append('clientCode', process.env.ERPLY_CC);
  getCustomersParams.append('sessionKey', sessionKey);
  getCustomersParams.append('request', 'getCustomers');
  getCustomersParams.append('searchEmail', email)
  let response = await fetch(ERPLY_URL, { method: 'POST', body: getCustomersParams });
  let data = await response.json();
  return data;
}

// Sync categories
function erplyWooCommerceCategoriesSync() {
  async function getErplyProductGroups () {
    const getProductCategoriesParams = new URLSearchParams();
    getProductCategoriesParams.append('clientCode', process.env.ERPLY_CC);
    getProductCategoriesParams.append('sessionKey', sessionKey);
    getProductCategoriesParams.append('request', 'getProductGroups');
    getProductCategoriesParams.append('sendContentType', 1);
    getProductCategoriesParams.append('recordsOnPage', 100);
    let response = await fetch(ERPLY_URL, { 
      method: 'POST', 
      body: getProductCategoriesParams 
    });
    let data = response.json();
    return data;
  }
  let categoriesSyncPromise = new Promise((resolve, reject) => {
    getErplyProductGroups()
    .then(erplyResponse => {
      const groupsFromErply = erplyResponse.records;
      let activeGroups =  [];
      let archivedGroups =  [];
      groupsFromErply.map((group) => {
        if (group.showInWebshop === '1') {
          activeGroups.push(group);
        } else if (group.showInWebshop === '0') {
          archivedGroups.push(group);
        }
      });
      WooCommerce
      .get("products/categories", {per_page: 100})
      .then((response) => {
        let notSavedCategories;
        const wooCommerceCategories = response.data;
        // Remove categories already present in WC from ERPLY list
        notSavedCategories = removeDuplicates(wooCommerceCategories, activeGroups);
        if (notSavedCategories.length !== 0) {
          let counter = 0;
          let categoryIDs = [];
          notSavedCategories.map((group) => {
            // Save new categories from ERPLY to WC
            WooCommerce.post("products/categories", {
              name: group.name.trim(),
              parent: group.parentGroupID,
              menu_order: group.positionNo
            })
            .then((response) => {
              counter++;
              console.log('Updated category: ' + response.data.name 
                + '. Categories updated: ' + counter + '.');
            })
            .catch((error) => {
              console.log({
                status: error.response.status,
                statusText: error.response.statusText,
                code: error.response.data.code,
                message: error.response.data.message,
                data: error.response.data.data
              });
            });
          });
        } 
        if (archivedGroups.length !== 0) {
          archivedGroups.map((group) => {
            for (let i = 0; i < wooCommerceCategories.length; i++) {
              if (group.name.trim() === wooCommerceCategories[i].name) {
                console.log('Category to delete:', group.name.trim());
                WooCommerce.delete(`products/categories/${wooCommerceCategories[i].id}`, {
                  force: true
                })
                .then((response) => {
                  console.log('Deleted category:', response.data.name);
                })
                .catch((error) => {
                  console.log({
                    status: error.response.status,
                    statusText: error.response.statusText,
                    code: error.response.data.code,
                    message: error.response.data.message,
                    data: error.response.data.data
                  });
                });
              }
            }
          });
        }
        resolve('All categories are up to date.')
      })
      .catch((error) => {
        console.log({
          status: error.response.status,
          statusText: error.response.statusText,
          code: error.response.data.code,
          message: error.response.data.message,
          data: error.response.data.data
        });
        reject(error)
      });
    })
    .catch((err) => {
      console.log(err);
    });
  });
  return Promise.resolve(categoriesSyncPromise);
}

// Sync brands
function erplyWooCommerceBrandsSync() {
  let brandsSyncPromise = new Promise((resolve, reject) => {
    WooCommerce.get(`products/attributes`)
    .then((response) => {
      const brandAttribute = findObjectByKey(response.data, 'name', 'Bränd');
      if (brandAttribute !== null) {
        getErplyBrands()
        .then(erplyBrands => {
          const brandsFromErply = erplyBrands.records;
          WooCommerce.get(`products/attributes/${brandAttribute.id}/terms`)
          .then((response) => {
            let notSavedBrandsOnWC;
            const wooCommerceBrands = response.data;
            notSavedBrandsOnWC = removeDuplicates(wooCommerceBrands, brandsFromErply);
            // console.log('Brands to add: ', notSavedBrandsOnWC.length)
            if (notSavedBrandsOnWC.length === 0) {
              resolve('Brands on WooCommerce are up to date with Erply.');
              return false
            }
            notSavedBrandsOnWC.map((brand) => {
              const data = {
                name: brand.name
              };
              WooCommerce.post(`products/attributes/${brandAttribute.id}/terms`, data)
              .then((response) => {
                console.log(`Added ${response.data.name} to WC brands list`);
              })
              .catch((error) => {
                console.log({
                  status: error.response.status,
                  statusText: error.response.statusText,
                  code: error.response.data.code,
                  message: error.response.data.message,
                  data: error.response.data.data
                });
              });
            });
            resolve('Missing brands added');
          })
          .catch((error) => {
            console.log({
              status: error.response.status,
              statusText: error.response.statusText,
              code: error.response.data.code,
              message: error.response.data.message,
              data: error.response.data.data
            });
            reject(error)
          });
        })
        .catch((error) => {
          console.log(error);
        });
      } else {
        const data = {
          name: "Bränd",
          slug: "pa_brand",
          type: "select",
          order_by: "menu_order",
          has_archives: true
        };
        WooCommerce.post("products/attributes", data)
        .then((response) => {
          console.log(`Added attribute ${response.data.name} to WC.`);
          const brandAttrId = response.data.id;
          getErplyBrands()
          .then(erplyBrands => {
            const brandsFromErply = erplyBrands.records;
            WooCommerce.get(`products/attributes/${brandAttrId}/terms`)
            .then((response) => {
              let notSavedBrands;
              const wooCommerceBrands = response.data;
              notSavedBrands = removeDuplicates(wooCommerceBrands, brandsFromErply);
              // console.log('Brands not added to WC: ', notSavedBrands.length)
              notSavedBrands.map((brand) => {
                const data = {
                  name: brand.name
                };
                WooCommerce.post(`products/attributes/${brandAttrId}/terms`, data)
                .then(() => {})
                .catch((error) => {
                  console.log({
                    status: error.response.status,
                    statusText: error.response.statusText,
                    code: error.response.data.code,
                    message: error.response.data.message,
                    data: error.response.data.data
                  });
                });
              })
              resolve('Brands added to WooCommerce')
            })
            .catch((error) => {
              console.log({
                status: error.response.status,
                statusText: error.response.statusText,
                code: error.response.data.code,
                message: error.response.data.message,
                data: error.response.data.data
              });
              reject(error)
            });
          })
          .catch((error) => {
            console.log(error);
          });
        })
        .catch((error) => {
          console.log({
            status: error.response.status,
            statusText: error.response.statusText,
            code: error.response.data.code,
            message: error.response.data.message,
            data: error.response.data.data
          });
        });
      }
    })
    .catch((error) => {
      console.log({
        status: error.response.status,
        statusText: error.response.statusText,
        code: error.response.data.code,
        message: error.response.data.message,
        data: error.response.data.data
      });
    });
  });
  return Promise.resolve(brandsSyncPromise);
}

// Send order to Erply
function sendOrderToErply(customerEmail, customerFirstName, customerLastName, orderTotal, shippingMethod,lineitemsFromWCOrder, orderLineitems) {
  let lineitemDataPromise = [];
  for (let i = 0; i < lineitemsFromWCOrder.length; i++) {
    lineitemDataPromise.push(new Promise((resolve, reject) => {
        WooCommerce.get(`products/${lineitemsFromWCOrder[i].product_id}/variations/${lineitemsFromWCOrder[i].variation_id}`)
        .then((response) => {
          const erply_id = response.data.meta_data.filter((meta) => meta.key === 'erply_id');
          resolve({
            productID: erply_id[0].value,
            amount: lineitemsFromWCOrder[i].quantity,
            price: lineitemsFromWCOrder[i].price
          });
        })
        .catch((error) => {
          console.log(error);
          reject(error)
        });
      })
    )
  }
  return Promise.all(lineitemDataPromise)
  .then((data) => {
    orderLineitems = data;
    verifyErplyUser()
    .then((userVerify) => {
      if (userVerify.status.errorCode >= 1000 && userVerify.status.errorCode <= 1009) {
        console.log('Server down. Error code: ' + userVerify.status.errorCode + '. Retry: ' + current);
        current++;
        verifyErplyUser()
      }
      if (userVerify.status.errorCode === 0) {
        console.log('Got session key... moving forward.')
        sessionKey = userVerify.records[0].sessionKey;
        getCustomers(customerEmail)
        .then(customer => {
          let customerIDInErply;
          if (customer.status.recordsTotal >= 1) {
            let filteredCustomer = customer.records.filter(customer => customer.email === customerEmail);
            customerIDInErply = filteredCustomer[0].customerID;
            console.log('Customer Email exists', customerIDInErply)
            saveOrderToErply(userVerify.records[0].sessionKey, customerIDInErply, orderLineitems, orderTotal, shippingMethod)
            .then((savedOrderResponse) => { 
              console.log(savedOrderResponse) 
              console.log('New order saved to Erply');
            })
            .catch(err => console.log('Order Paid Save Erply Order Error: ', err))
          } 
          else {
            saveCustomer(customerEmail, customerFirstName, customerLastName)
            .then(saveResponse => {
              customerIDInErply = saveResponse.records[0].customerID;
              saveOrderToErply(userVerify.records[0].sessionKey, customerIDInErply, orderLineitems, orderTotal, shippingMethod)
              .then((savedOrderResponse) => { 
                console.log(savedOrderResponse) 
                console.log('New order saved to Erply');
              })
              .catch(err => console.log('Order Paid Save Erply Order Error: ', err))
            })
            .catch(err => console.log('Order Paid Save Customer Error: ', err))
          }
        })
        .catch(err => console.log('Order Paid Get Customer Error: ', err))
      }
    }).catch(err => console.log('Order Paid Verify User Error: ',err));
  })
  .catch(err => console.log('Order Paid Get Line Items Data Error: ', err));
}

module.exports = { 
  verifyErplyUser,
  getPaymentTypes,
  getErplyProducts,
  getOnlyChangedErplyProducts,
  getErplyStockData,
  getErplyBrands,
  getPriceLists,
  getProductPricesInPriceLists,
  saveCustomer,
  getCustomers,
  erplyWooCommerceCategoriesSync,
  erplyWooCommerceBrandsSync,
  sendOrderToErply
};