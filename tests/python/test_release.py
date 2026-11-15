"""Regression coverage for the Python release tag guard."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    'distribution_check', Path(__file__).resolve().parents[2] / 'scripts/check-python-distribution.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReleaseTest(unittest.TestCase):
    def test_exact_python_version_tag(self):
        module.check_tag('0.1.0', 'python-v0.1.0')

    def test_rejects_other_ecosystem_or_mismatched_version(self):
        for tag in ['v0.1.0', 'rust-v0.1.0', 'python-v0.0.0', 'python-v0.1.0rc1', 'python-v0.1.0-extra', '']:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                module.check_tag('0.1.0', tag)
