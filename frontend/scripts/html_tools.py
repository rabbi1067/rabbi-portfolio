"""Small source-preserving HTML reader used for migration and build checks."""
from html.parser import HTMLParser


class Node:
    def __init__(self, tag='', attrs=(), start=0, inner=0, parent=None):
        self.tag, self.attrs = tag, dict(attrs)
        self.start, self.inner, self.end_inner, self.end = start, inner, inner, inner
        self.parent, self.children = parent, []

    def find_all(self, tag=None, cls=None, id=None):
        found = []
        for child in self.children:
            if ((not tag or child.tag == tag) and
                (not cls or cls in child.attrs.get('class', '').split()) and
                (not id or child.attrs.get('id') == id)):
                found.append(child)
            found.extend(child.find_all(tag, cls, id))
        return found

    def find(self, tag=None, cls=None, id=None):
        return self.find_all(tag, cls, id)[0]


class Document(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.offsets = [0]
        for line in source.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)

    def position(self):
        line, col = self.getpos()
        return self.offsets[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.position()
        node = Node(tag, attrs, start, start + len(self.get_starttag_text()), self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                node = self.stack[index]
                node.end_inner = self.position()
                node.end = self.source.index('>', node.end_inner) + 1
                self.stack = self.stack[:index]
                break

    def inside(self, node):
        return self.source[node.inner:node.end_inner]

    def outside(self, node):
        return self.source[node.start:node.end]
