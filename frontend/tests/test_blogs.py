import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import blogs
import build

class BlogTests(unittest.TestCase):
    def setUp(self):
        self.post = build.read_json(build.ROOT / 'content/blogs/competitive-programming-meetup-july-2024.json')
        self.data = {'blogs': [self.post], 'site-settings': {}}

    def test_visibility_and_preview(self):
        self.assertIn(self.post['title'], blogs.render_blog_preview(self.data))
        self.post['published'] = False
        self.assertEqual(blogs.render_blog_preview(self.data), '')
        self.post['published'] = True
        self.data['site-settings'] = {'sections': {'blogs': {'visible': False}}}
        self.assertEqual(blogs.posts(self.data), [])

    def test_body_escapes_html_and_supports_headings(self):
        value = blogs.render_body('## Title\n\n**Bold** <script>alert(1)</script>')
        self.assertIn('<h2>Title</h2>', value)
        self.assertIn('<strong>Bold</strong>', value)
        self.assertNotIn('<script>', value)
        self.assertIn('&lt;script&gt;', value)

    def test_generated_pages_and_deleted_post(self):
        home = '<html><head><title>Home</title></head><body><nav id="navbar"><a href="#home" class="active">Home</a><a data-blog-nav href="blogs/">Blogs</a></nav><footer><a href="#contact">Contact</a></footer></body></html>'
        with tempfile.TemporaryDirectory(dir=build.ROOT/'.qa') as directory:
            output = Path(directory)
            blogs.write_blog_pages(self.data, output, home, 'https://example.test/portfolio', '/portfolio', lambda source,*_:source)
            page = (output / 'blogs' / self.post['id'] / 'index.html').read_text(encoding='utf-8')
            self.assertIn('<base href="../../"', page)
            self.assertIn('href="index.html#home"', page)
            self.assertIn('aria-current="page"', page)
            self.assertIn('July 2024', page)
            self.assertEqual(page.count('class="blog-slide is-active"') + page.count('class="blog-slide"'), 2)
            self.assertIn('seu-programmers-meetup-july-2024-02.jpg', page)
            self.assertNotIn('cms-runtime.js', page)
            self.post['published'] = False
            self.assertEqual(blogs.posts(self.data), [])

    def test_blog_schema_and_invalid_date(self):
        fields=build.read_json(build.ROOT/'cms/schema.json')['blogs']
        build.validate_fields(self.post,fields,'blogs')
        self.post['published_date']='2026-99-42'
        with self.assertRaises(ValueError):build.validate_fields(self.post,fields,'blogs')
