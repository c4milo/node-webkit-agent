srcdir = "."
blddir = "build"

def set_options(ctx):
  ctx.add_option('--exe', action='store_true', default=False)
  ctx.recurse('src')

def configure(ctx):
  ctx.recurse('src')

def build(ctx):
  ctx.recurse('src')