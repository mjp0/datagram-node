module.exports = function(work) {
  let ready = false
  const fns = []
  process.nextTick(function() {
    work(function() {
      ready = true
      fns.forEach(process.nextTick)
    })
  })
  return function(fn) {
    if (!ready) fns.push(fn)
    else process.nextTick(fn)
  }
}
