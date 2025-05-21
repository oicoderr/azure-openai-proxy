function testFunction() {
  function innerFunction() {
    try {
      throw new Error("Test Error");
    } catch (e) {
      console.log(e.stack);
    }
  }
  innerFunction();
}
testFunction();
